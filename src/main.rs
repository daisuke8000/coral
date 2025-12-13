use anyhow::Result;
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "coral", about = "Proto dependency visualizer")]
struct Cli {
    #[arg(long)]
    debug: bool,
    #[arg(long)]
    summary: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();

    let bytes = coral::read_stdin()?;

    let fds = coral::decoder::decoder(&bytes)?;

    if cli.debug {
        coral::debug_output(&fds);
    } else if cli.summary {
        println!("Files: {}", fds.file.len());
    }

    Ok(())
}
