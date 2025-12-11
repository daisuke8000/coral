use anyhow::Result;
use clap::Parser;

#[derive(Parser)]
#[command(name = "coral", about = "Proto dependency visualizer")]
struct Args {
    #[arg(long)]
    debug: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    if args.debug {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug")).init();
    } else {
        env_logger::init();
    }
    log::info!("Coral starting...");
    Ok(())
}
