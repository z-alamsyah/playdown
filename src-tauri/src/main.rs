// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--version" || a == "-v") {
        println!("playdown {}", env!("CARGO_PKG_VERSION"));
        return;
    }
    if args.iter().any(|a| a == "--update") {
        run_update();
        return;
    }
    if args.iter().any(|a| a == "--help" || a == "-h") {
        println!(
            "Playdown — lightweight markdown editor & viewer\n\n\
             Usage:\n  \
             playdown [path]      open a folder (or file)\n  \
             playdown .           open the current folder\n  \
             playdown --update    update to the latest release\n  \
             playdown --version   print version\n  \
             playdown --help      show this help"
        );
        return;
    }
    playdown_lib::run()
}

/// `playdown --update` — re-run the install script to fetch the latest release.
#[cfg(not(windows))]
fn run_update() {
    let url = "https://raw.githubusercontent.com/z-alamsyah/playdown/main/install.sh";
    println!("Updating Playdown to the latest release…");
    let ok = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("curl -fsSL {url} | bash"))
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if ok {
        println!("Update complete. If Playdown is already open, quit and reopen to finish.");
    } else {
        eprintln!("Update failed. Install manually from {url}");
        std::process::exit(1);
    }
}

#[cfg(windows)]
fn run_update() {
    println!("Auto-update isn't supported on Windows yet.");
    println!("Get the latest installer: https://github.com/z-alamsyah/playdown/releases/latest");
}
