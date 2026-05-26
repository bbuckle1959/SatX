mod starlink;
mod tle_catalog;

use starlink::get_dish_alignment;
use tle_catalog::fetch_active_tles;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_dish_alignment, fetch_active_tles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
