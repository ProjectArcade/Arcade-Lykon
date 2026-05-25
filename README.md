# Lykon Browser

Lykon is a privacy-focused browser forked from Mozilla Firefox with a cleaner default UI, tracker protection, and built-in ad-blocking.

![Lykon browser home screen](Ref/bakedUI/HomePage.png)

Key highlights:
- Firefox foundation with privacy-first features
- Built-in ad/tracker blocking and a Shield UI
- Fast iteration for front-end and UX changes

Quick build (developer):

```bash
# from repository root
./mach build faster   # front-end only (fast)
./mach run            # run the built browser locally
```

Full build:

```bash
./mach build
```

Prerequisites (typical):
- Python 3.8+
- Rust (for some native components)
- C++ compiler (GCC/Clang) and standard build toolchain
- ~15 GB free disk and 8+ GB RAM recommended

Telemetry Configuration:

Lykon supports automated crash telemetry reporting to Axiom. To build and package the browser with telemetry pre-configured, define either the `AXIOM_TOKEN` or `AXIOM_API_KEY` in your environment or in a local `.env` file:

```bash
# Create a local .env file in the repository root (git-ignored)
AXIOM_TOKEN="your_axiom_api_key"
```

### How it Works

During the build process (`./mach build` or `./mach build faster`), the build system runs the generator script to bake the API key into a git-ignored module `TelemetryConfig.sys.mjs` inside the object build directory. 

* **No GitHub Leaks**: Because `TelemetryConfig.sys.mjs` and `.env` are completely ignored by Git, the sensitive API key is never committed or pushed to GitHub.
* **Ready for Packaging**: When you run `./mach package`, the pre-built `TelemetryConfig.sys.mjs` is automatically packaged into the distributed browser archive (e.g. `omni.ja`). Telemetry will function perfectly for all 100+ packaged users out-of-the-box without requiring any local environment configuration on their machines.

### Code Locations

- **Build Generator**: [browser/modules/generate_telemetry_config.py](browser/modules/generate_telemetry_config.py)
- **Tab Crash Telemetry**: [browser/modules/ContentCrashHandlers.sys.mjs](browser/modules/ContentCrashHandlers.sys.mjs)
- **General Crash Telemetry**: [toolkit/components/crashes/CrashManager.in.sys.mjs](toolkit/components/crashes/CrashManager.in.sys.mjs)

Contributing:

1. Fork the repository and create a branch (`git checkout -b feature/my-feature`)
2. Make changes and test locally (`./mach run`)
3. Commit cleanly and open a PR against main with a description and screenshots

Report bugs and security issues using [SECURITY.md](SECURITY.md).

See [LICENSE](LICENSE) for licensing details.

