// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--version" || a == "-v") {
        println!("playdown {}", env!("CARGO_PKG_VERSION"));
        return;
    }
    if args.iter().any(|a| a == "--help" || a == "-h") {
        println!(
            "Playdown — lightweight markdown editor & viewer\n\n\
             Usage:\n  \
             playdown [path]      open a folder (or file)\n  \
             playdown .           open the current folder\n  \
             playdown --version   print version\n  \
             playdown --help      show this help"
        );
        return;
    }
    playdown_lib::run()
}
