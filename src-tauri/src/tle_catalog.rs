use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

const TLE_API_BASE: &str = "https://tle.ivanstanojevic.me/api/tle/";
const GITHUB_ACTIVE_TLE: &str =
    "https://raw.githubusercontent.com/satvisorcom/satvisor-data/master/celestrak/tle/active.tle";
const RETLECTOR_ACTIVE_TLE: &str = "https://retlector.eu/tle/active";
const PAGE_SIZE: u32 = 100;
const PAGE_CONCURRENCY: usize = 12;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);
const USER_AGENT: &str = "SatX/0.1 (satellite tracker)";

#[derive(Debug, Clone, Serialize)]
pub struct TleRecordDto {
    pub name: String,
    pub line1: String,
    pub line2: String,
    pub id: String,
}

#[derive(Debug, Deserialize)]
struct TleApiMember {
    name: String,
    line1: String,
    line2: String,
}

#[derive(Debug, Deserialize)]
struct TleApiView {
    last: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TleApiPage {
    member: Vec<TleApiMember>,
    view: Option<TleApiView>,
}

fn norad_id_from_line1(line1: &str) -> Option<String> {
    if line1.len() < 7 {
        return None;
    }
    let id = line1[2..7].trim();
    if id.is_empty() {
        None
    } else {
        Some(id.to_string())
    }
}

fn parse_tle_text(text: &str) -> Vec<TleRecordDto> {
    let lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();

    let mut records = Vec::new();
    let mut i = 0;
    while i + 2 < lines.len() {
        let name = lines[i].to_string();
        let line1 = lines[i + 1].to_string();
        let line2 = lines[i + 2].to_string();
        i += 3;

        if !line1.starts_with("1 ") || !line2.starts_with("2 ") {
            continue;
        }
        let Some(id) = norad_id_from_line1(&line1) else {
            continue;
        };
        records.push(TleRecordDto {
            name,
            line1,
            line2,
            id,
        });
    }
    records
}

fn member_to_record(member: TleApiMember) -> Option<TleRecordDto> {
    if !member.line1.starts_with("1 ") || !member.line2.starts_with("2 ") {
        return None;
    }
    let id = norad_id_from_line1(&member.line1)?;
    Some(TleRecordDto {
        name: member.name,
        line1: member.line1,
        line2: member.line2,
        id,
    })
}

fn append_members(records: &mut Vec<TleRecordDto>, members: Vec<TleApiMember>) {
    for member in members {
        if let Some(record) = member_to_record(member) {
            records.push(record);
        }
    }
}

async fn fetch_tle_text_url(client: &Client, url: &str, label: &str) -> Result<Vec<TleRecordDto>, String> {
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("{label}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("{label}: HTTP {}", response.status()));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("{label}: {e}"))?;
    let records = parse_tle_text(&text);
    if records.is_empty() {
        return Err(format!("{label}: no parseable TLE records"));
    }
    Ok(records)
}

async fn fetch_page(client: &Client, page: u32) -> Result<TleApiPage, String> {
    let url = format!("{TLE_API_BASE}?page={page}&page-size={PAGE_SIZE}");
    let response = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("TLE API page {page}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "TLE API page {page}: HTTP {}",
            response.status()
        ));
    }

    response
        .json::<TleApiPage>()
        .await
        .map_err(|e| format!("TLE API page {page} JSON: {e}"))
}

async fn fetch_from_ivan_api(client: &Client) -> Result<Vec<TleRecordDto>, String> {
    let first = fetch_page(client, 1).await?;
    let last_page = first
        .view
        .as_ref()
        .and_then(|v| v.last.as_deref())
        .and_then(|last_url| {
            reqwest::Url::parse(last_url).ok().and_then(|u| {
                u.query_pairs()
                    .find(|(k, _)| k == "page")
                    .and_then(|(_, v)| v.parse::<u32>().ok())
            })
        })
        .filter(|&p| p >= 1)
        .unwrap_or(1);

    let mut records = Vec::new();
    append_members(&mut records, first.member);

    let mut start = 2u32;
    while start <= last_page {
        let end = (start + PAGE_CONCURRENCY as u32 - 1).min(last_page);
        let mut batch_results = Vec::new();
        for page in start..=end {
            batch_results.push(fetch_page(client, page));
        }
        let pages = futures_util::future::try_join_all(batch_results).await?;
        for page in pages {
            append_members(&mut records, page.member);
        }
        start = end + 1;
    }

    if records.is_empty() {
        return Err("TLE API: no parseable records".into());
    }

    Ok(records)
}

/// Active catalog — tries GitHub / ReTLEctor mirrors before paginated APIs.
#[tauri::command]
pub async fn fetch_active_tles() -> Result<Vec<TleRecordDto>, String> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("HTTP client: {e}"))?;

    let mut failures: Vec<String> = Vec::new();

    for (label, url) in [
        ("GitHub mirror", GITHUB_ACTIVE_TLE),
        ("ReTLEctor mirror", RETLECTOR_ACTIVE_TLE),
    ] {
        match fetch_tle_text_url(&client, url, label).await {
            Ok(records) => return Ok(records),
            Err(err) => failures.push(err),
        }
    }

    match fetch_from_ivan_api(&client).await {
        Ok(records) => return Ok(records),
        Err(err) => failures.push(err),
    }

    Err(if failures.is_empty() {
        "No catalog sources available".into()
    } else {
        failures.join(" · ")
    })
}
