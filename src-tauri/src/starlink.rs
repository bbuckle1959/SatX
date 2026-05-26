use std::time::Duration;

use reqwest::Client;
use serde::Serialize;

const DISH_GRPC_WEB_URL: &str =
    "http://192.168.100.1:9201/SpaceX.API.Device.Device/Handle";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

// Protobuf field numbers (SpaceX.API.Device)
const FIELD_GET_STATUS: u32 = 1004;
const FIELD_DISH_GET_STATUS: u32 = 2004;
const FIELD_OBSTRUCTION_STATS: u32 = 1004;
const FIELD_ALERTS: u32 = 1005;
const FIELD_BORESIGHT_AZIMUTH: u32 = 1011;
const FIELD_BORESIGHT_ELEVATION: u32 = 1012;
const FIELD_ALIGNMENT_STATS: u32 = 1027;
const FIELD_ALIGN_BORESIGHT_AZIMUTH: u32 = 4;
const FIELD_ALIGN_BORESIGHT_ELEVATION: u32 = 5;
const FIELD_ALIGN_DESIRED_AZIMUTH: u32 = 8;
const FIELD_ALIGN_DESIRED_ELEVATION: u32 = 9;
const FIELD_SNR_ABOVE_NOISE: u32 = 1018;
const FIELD_MOTORS_STUCK: u32 = 1;
const FIELD_OBSTRUCTION_CURRENT: u32 = 5;

#[derive(Debug, Clone, Serialize)]
pub struct StarlinkAlignment {
    pub azimuth_deg: f32,
    pub elevation_deg: f32,
    pub is_aligned: bool,
}

#[tauri::command]
pub async fn get_dish_alignment() -> Result<StarlinkAlignment, String> {
    fetch_via_grpc_web().await
}

async fn fetch_via_grpc_web() -> Result<StarlinkAlignment, String> {
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|err| format!("Failed to create HTTP client: {err}"))?;

    let request_body = build_get_status_request();

    let response = client
        .post(DISH_GRPC_WEB_URL)
        .header("content-type", "application/grpc-web+proto")
        .header("accept", "application/grpc-web+proto")
        .header("x-grpc-web", "1")
        .body(encode_grpc_web_frame(&request_body))
        .send()
        .await
        .map_err(map_request_error)?;

    if !response.status().is_success() {
        return Err(format!(
            "Starlink dish returned HTTP {} from {}",
            response.status(),
            DISH_GRPC_WEB_URL
        ));
    }

    let body = response
        .bytes()
        .await
        .map_err(|err| format!("Failed to read Starlink dish response: {err}"))?;

    let proto = decode_grpc_web_payload(&body)?;
    parse_status_proto(&proto)
}

/// `Request { get_status: {} }` — field 1004, empty `GetStatusRequest`.
fn build_get_status_request() -> Vec<u8> {
    let mut buf = Vec::new();
    write_varint(&mut buf, ((FIELD_GET_STATUS << 3) | 2) as u64);
    write_varint(&mut buf, 0);
    buf
}

fn parse_status_proto(bytes: &[u8]) -> Result<StarlinkAlignment, String> {
    let dish_status = find_length_delimited_submessage(bytes, FIELD_DISH_GET_STATUS);
    let status_scope: &[u8] = dish_status.as_deref().unwrap_or(bytes);

    let (azimuth_deg, elevation_deg) = find_boresight_pair(status_scope)
        .or_else(|| find_boresight_pair(bytes))
        .ok_or_else(|| missing_field("boresight azimuth"))?;

    Ok(StarlinkAlignment {
        azimuth_deg,
        elevation_deg,
        is_aligned: compute_is_aligned(status_scope),
    })
}

/// Dish firmware may expose boresight on the status root (1011/1012) or inside `alignment_stats` (4/5).
fn find_boresight_pair(bytes: &[u8]) -> Option<(f32, f32)> {
    if let Some(pair) = find_root_boresight(bytes) {
        return Some(pair);
    }

    if let Some(align) = find_length_delimited_submessage(bytes, FIELD_ALIGNMENT_STATS) {
        if let Some(pair) = find_alignment_stats_boresight(&align) {
            return Some(pair);
        }
    }

    // Some builds nest alignment stats without the outer 1027 wrapper in our slice.
    if let Some(pair) = find_alignment_stats_boresight(bytes) {
        return Some(pair);
    }

    find_boresight_in_nested_messages(bytes)
}

fn plausible_boresight(azimuth_deg: f32, elevation_deg: f32) -> bool {
    azimuth_deg.is_finite()
        && elevation_deg.is_finite()
        && (-360.0..=360.0).contains(&azimuth_deg)
        && (-10.0..=120.0).contains(&elevation_deg)
}

fn find_boresight_in_nested_messages(bytes: &[u8]) -> Option<(f32, f32)> {
    let mut stack: Vec<&[u8]> = vec![bytes];
    while let Some(buf) = stack.pop() {
        if let Some((az, el)) = find_alignment_stats_boresight(buf) {
            if plausible_boresight(az, el) {
                return Some((az, el));
            }
        }
        collect_submessages(buf, &mut stack);
    }
    None
}

fn collect_submessages<'a>(bytes: &'a [u8], stack: &mut Vec<&'a [u8]>) {
    let mut offset = 0usize;
    while offset < bytes.len() {
        let (tag, next) = match read_varint(bytes, offset) {
            Ok(v) => v,
            Err(()) => break,
        };
        offset = next;
        let wire_type = (tag & 0x07) as u32;
        match wire_type {
            0 => {
                let (_, next) = match read_varint(bytes, offset) {
                    Ok(v) => v,
                    Err(()) => break,
                };
                offset = next;
            }
            1 => offset += 8,
            2 => {
                let (len, data_start) = match read_varint(bytes, offset) {
                    Ok(v) => v,
                    Err(()) => break,
                };
                offset = data_start;
                let end = offset.saturating_add(len as usize);
                if end <= bytes.len() {
                    stack.push(&bytes[offset..end]);
                    offset = end;
                } else {
                    break;
                }
            }
            5 => offset += 4,
            _ => break,
        }
    }
}

fn find_root_boresight(bytes: &[u8]) -> Option<(f32, f32)> {
    let azimuth_deg = find_fixed32_field(bytes, FIELD_BORESIGHT_AZIMUTH)?;
    let elevation_deg = find_fixed32_field(bytes, FIELD_BORESIGHT_ELEVATION)?;
    Some((azimuth_deg, elevation_deg))
}

fn find_alignment_stats_boresight(bytes: &[u8]) -> Option<(f32, f32)> {
    let azimuth_deg = find_fixed32_field(bytes, FIELD_ALIGN_BORESIGHT_AZIMUTH)
        .or_else(|| find_fixed32_field(bytes, FIELD_ALIGN_DESIRED_AZIMUTH))?;
    let elevation_deg = find_fixed32_field(bytes, FIELD_ALIGN_BORESIGHT_ELEVATION)
        .or_else(|| find_fixed32_field(bytes, FIELD_ALIGN_DESIRED_ELEVATION))?;
    if plausible_boresight(azimuth_deg, elevation_deg) {
        Some((azimuth_deg, elevation_deg))
    } else {
        None
    }
}

fn compute_is_aligned(status_bytes: &[u8]) -> bool {
    let motors_stuck = find_length_delimited_submessage(status_bytes, FIELD_ALERTS)
        .and_then(|alerts| find_bool_field(&alerts, FIELD_MOTORS_STUCK))
        .unwrap_or(false);
    let obstructed =
        find_length_delimited_submessage(status_bytes, FIELD_OBSTRUCTION_STATS)
            .and_then(|stats| find_bool_field(&stats, FIELD_OBSTRUCTION_CURRENT))
            .unwrap_or(false);
    let snr_ok = find_bool_field(status_bytes, FIELD_SNR_ABOVE_NOISE).unwrap_or(true);

    !motors_stuck && !obstructed && snr_ok
}

fn map_request_error(err: reqwest::Error) -> String {
    if err.is_timeout() {
        return "Timed out reaching the Starlink dish at 192.168.100.1:9201. \
                Connect to your Starlink Wi‑Fi or dish network and try again."
            .to_string();
    }

    if err.is_connect() {
        return "Could not connect to the Starlink dish at 192.168.100.1:9201. \
                You may not be on the dish local network (192.168.100.0/24)."
            .to_string();
    }

    format!("Starlink dish request failed: {err}")
}

/// gRPC-Web data frame: 1-byte flags (0) + 4-byte big-endian length + payload.
fn encode_grpc_web_frame(payload: &[u8]) -> Vec<u8> {
    let len = payload.len() as u32;
    let mut frame = Vec::with_capacity(5 + payload.len());
    frame.push(0);
    frame.extend_from_slice(&len.to_be_bytes());
    frame.extend_from_slice(payload);
    frame
}

fn decode_grpc_web_payload(body: &[u8]) -> Result<Vec<u8>, String> {
    if body.is_empty() {
        return Err(
            "Starlink dish returned an empty response body. \
             The dish may still be booting, or this network path does not expose dish gRPC."
                .to_string(),
        );
    }

    let mut chunks = Vec::new();
    let mut offset = 0usize;

    while offset + 5 <= body.len() {
        let flags = body[offset];
        let len = u32::from_be_bytes(body[offset + 1..offset + 5].try_into().unwrap()) as usize;
        offset += 5;
        if offset + len > body.len() {
            break;
        }
        let chunk = &body[offset..offset + len];
        offset += len;

        if flags & 0x80 != 0 || chunk.is_empty() {
            continue;
        }

        chunks.push(chunk.to_vec());
    }

    if !chunks.is_empty() {
        for chunk in &chunks {
            if find_boresight_pair(chunk).is_some() {
                return Ok(chunk.clone());
            }
        }
        let largest = chunks.into_iter().max_by_key(|c| c.len()).unwrap();
        return Ok(largest);
    }

    if body.first() == Some(&b'{') {
        return Err(
            "Starlink dish returned JSON, but this dish API expects protobuf (grpc-web+proto)."
                .to_string(),
        );
    }

    Ok(body.to_vec())
}

fn find_length_delimited_submessage(bytes: &[u8], field_number: u32) -> Option<Vec<u8>> {
    let mut found = None;
    for_each_proto_field(bytes, &mut |field, wire_type, value_offset, buf| {
        if field == field_number && wire_type == 2 {
            let (len, data_start) = match read_varint(buf, value_offset) {
                Ok(v) => v,
                Err(()) => return false,
            };
            let end = data_start.saturating_add(len as usize);
            if end <= buf.len() {
                found = Some(buf[data_start..end].to_vec());
                return true;
            }
        }
        false
    });
    found
}

fn find_fixed32_field(bytes: &[u8], field_number: u32) -> Option<f32> {
    let mut found = None;
    for_each_proto_field(bytes, &mut |field, wire_type, value_offset, buf| {
        if field == field_number && wire_type == 5 && value_offset + 4 <= buf.len() {
            if let Ok(raw) = buf[value_offset..value_offset + 4].try_into() {
                found = Some(f32::from_le_bytes(raw));
                return true;
            }
        }
        false
    });
    found
}

fn find_bool_field(bytes: &[u8], field_number: u32) -> Option<bool> {
    let mut found = None;
    for_each_proto_field(bytes, &mut |field, wire_type, value_offset, buf| {
        if field == field_number && wire_type == 0 {
            if let Ok((value, _)) = read_varint(buf, value_offset) {
                found = Some(value != 0);
                return true;
            }
        }
        false
    });
    found
}

/// Iterates protobuf fields depth-first. Return `true` from the visitor to stop early.
fn for_each_proto_field<F>(bytes: &[u8], visit: &mut F) -> bool
where
    F: FnMut(u32, u32, usize, &[u8]) -> bool,
{
    let mut stack: Vec<&[u8]> = vec![bytes];

    while let Some(buf) = stack.pop() {
        let mut offset = 0usize;
        while offset < buf.len() {
            let (tag, next) = match read_varint(buf, offset) {
                Ok(v) => v,
                Err(()) => return false,
            };
            offset = next;
            let wire_type = (tag & 0x07) as u32;
            let field_number = (tag >> 3) as u32;

            match wire_type {
                0 => {
                    if visit(field_number, wire_type, offset, buf) {
                        return true;
                    }
                    let (_, next) = match read_varint(buf, offset) {
                        Ok(v) => v,
                        Err(()) => return false,
                    };
                    offset = next;
                }
                1 => {
                    if visit(field_number, wire_type, offset, buf) {
                        return true;
                    }
                    offset += 8;
                }
                2 => {
                    let (len, next) = match read_varint(buf, offset) {
                        Ok(v) => v,
                        Err(()) => return false,
                    };
                    offset = next;
                    let end = offset.saturating_add(len as usize);
                    if end > buf.len() {
                        return false;
                    }
                    if visit(field_number, wire_type, offset, buf) {
                        return true;
                    }
                    stack.push(&buf[offset..end]);
                    offset = end;
                }
                5 => {
                    if offset + 4 > buf.len() {
                        return false;
                    }
                    if visit(field_number, wire_type, offset, buf) {
                        return true;
                    }
                    offset += 4;
                }
                _ => return false,
            }
        }
    }

    false
}

fn read_varint(bytes: &[u8], mut offset: usize) -> Result<(u64, usize), ()> {
    let mut result = 0u64;
    let mut shift = 0;
    while offset < bytes.len() {
        let byte = bytes[offset];
        offset += 1;
        result |= ((byte & 0x7f) as u64) << shift;
        if byte & 0x80 == 0 {
            return Ok((result, offset));
        }
        shift += 7;
        if shift > 63 {
            return Err(());
        }
    }
    Err(())
}

fn write_varint(buf: &mut Vec<u8>, mut value: u64) {
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        buf.push(byte);
        if value == 0 {
            break;
        }
    }
}

fn missing_field(name: &str) -> String {
    format!("Starlink status response missing {name}.")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode_boresight_status(az: f32, el: f32) -> Vec<u8> {
        let mut buf = Vec::new();
        write_fixed32(&mut buf, FIELD_BORESIGHT_AZIMUTH, az);
        write_fixed32(&mut buf, FIELD_BORESIGHT_ELEVATION, el);
        write_varint(&mut buf, ((FIELD_SNR_ABOVE_NOISE << 3) | 0) as u64);
        write_varint(&mut buf, 1);
        buf
    }

    fn encode_alignment_stats_status(az: f32, el: f32) -> Vec<u8> {
        let mut align = Vec::new();
        write_fixed32(&mut align, FIELD_ALIGN_BORESIGHT_AZIMUTH, az);
        write_fixed32(&mut align, FIELD_ALIGN_BORESIGHT_ELEVATION, el);

        let mut status = Vec::new();
        write_varint(&mut status, ((FIELD_ALIGNMENT_STATS << 3) | 2) as u64);
        write_varint(&mut status, align.len() as u64);
        status.extend_from_slice(&align);
        status
    }

    fn write_fixed32(buf: &mut Vec<u8>, field_number: u32, value: f32) {
        write_varint(buf, ((field_number << 3) | 5) as u64);
        buf.extend_from_slice(&value.to_le_bytes());
    }

    #[test]
    fn get_status_request_encodes_field_1004() {
        assert_eq!(build_get_status_request(), vec![0xa2, 0x3e, 0x00]);
    }

    #[test]
    fn parses_framed_proto_status() {
        let payload = encode_boresight_status(12.5, 63.2);
        let frame = encode_grpc_web_frame(&payload);
        let proto = decode_grpc_web_payload(&frame).unwrap();
        let alignment = parse_status_proto(&proto).unwrap();
        assert!((alignment.azimuth_deg - 12.5).abs() < f32::EPSILON);
        assert!((alignment.elevation_deg - 63.2).abs() < f32::EPSILON);
        assert!(alignment.is_aligned);
    }

    #[test]
    fn parses_alignment_stats_nested_boresight() {
        let payload = encode_alignment_stats_status(-45.0, 62.0);
        let alignment = parse_status_proto(&payload).unwrap();
        assert!((alignment.azimuth_deg + 45.0).abs() < f32::EPSILON);
        assert!((alignment.elevation_deg - 62.0).abs() < f32::EPSILON);
    }

    #[test]
    fn detects_empty_body_message() {
        let err = decode_grpc_web_payload(&[]).unwrap_err();
        assert!(err.contains("empty response body"));
    }
}
