<p align=center>
         <img src='.images/phomber_logo.png'>
</p>

```
An open source infomation grathering & reconnaissance framework!
```

<p align=center>
         <a href='https://www.w3schools.in/ethical-hacking/information-gathering-techniques/'><img src="https://img.shields.io/badge/Etical Hacking-OSINT-yellow.svg?logo=sharp"></a>
         <a href='https://github.com/s41r4j/phomber/releases/'><img src="https://img.shields.io/badge/Version-v3.1.1-orange.svg?logo=vectorworks"></a>
         <a href='https://www.python.org/'><img src="https://img.shields.io/badge/Python-3-blue.svg?style=flat&logo=python"></a>
         <a href='LICENSE'><img src="https://img.shields.io/badge/License-GPL%20v3.0-brightgreen.svg"></a>
         <a href=''><img src="https://img.shields.io/badge/Disclaimer-With great power comes great responsibility-red.svg?logo=hackaday"></a>
</p>

<br>

<br>

## What is PH0MBER?

- `PH0MBER` is an __osint framework__, which is one-stop tool for your information gathering and reconnaissance needs
- It can help you gather information (such as phone numbers, ip address, domain name info, etc.) from various publicly available sources about the target

<br>
<br>

## Quick Guide

> Install, Update, Usage

<br>

### Installation:

- __git clone__

```
git clone https://github.com/s41r4j/phomber
cd phomber
pip3 install -r requirements.txt
```

- __pip__

```
pip install phomber
```

- __docker__

```
docker pull sinawic/phomber:latest
docker run --rm -it sinawic/phomber:latest
```

<br>

### Update:

- __git clone__ (assuming you are in the `phomber` directory)

```
git pull
```

- __pip__

```
pip install --upgrade phomber
```

- __docker__

```
docker pull sinawic/phomber:latest
```

<br>

### Usage:

- __git clone__ (assuming you are in the `phomber` directory)

```
python3 phomber.py
```

- __pip__

```
phomber
```

- __docker__

```
phomber
```

<br>

- Help menu

```
    ┌────────────────────────────────────────────────────┐
    | COMMANDS      | DESCRIPTION                        |
    |----------------------------------------------------|
    |                 <(Basic Commands)>                 |
    |----------------------------------------------------|
    | help          | Display this help menu             | 
    | exit/quit     | Exit the framework                 |
    | dork          | Show a random google dork query *  |  
    | exp           | Show info about all available      |       
    |               | expressions                        |
    | check         | Check internet connection          |
    | clear         | Clear screen                       |
    | flush         | Flush history                      |
    | save          | Save output of previous scanner    |
    |               | command in a file                  |
    | shell <cmd>   | Execute native shell/cmd commands  |
    | info          | Show info about framework & system |
    | change        | Change user command input color    |
    |----------------------------------------------------|
    |                <(Scanner Commands)>                |
    |----------------------------------------------------|
    | number        | Reverse phone number lookup        |
    | email         | Reverse email lookup *             |
    | ip            | Reverse ip address lookup *        |
    | mac           | Reverse mac address lookup         |
    | whois         | Reverse whois lookup *             |
    | dns           | Reverse / Normal DNS lookup *      |
    | username      | Username lookup over multiple sites|
    |               | and social media platforms *       |
    └────────────────────────────────────────────────────┘
```

#### Pro tips:

- Type `help` to get a list of commands
- Type `help <command>` to see more info about a command
- Use `Tab` key to auto-complete commands
- Try silent mode by using `-s`/`--silent` flag
- You can also use `Ctrl+C` to exit
- Descriptions ending with `*` needs internet connection
- Use `-e`/`--verbose-errors` flag to see more descriptive errors

<br>
<br>

### NOTES:

```
- `PH0MBER` is back with all new features and user interface
- `number` scan supports API-first mode if `PHOMBER_NUMLOOKUP_API_KEY` (or `NUMLOOKUP_API_KEY`) is set
- if API is unavailable, `number` automatically falls back to the local basic scan
- all scanners now display estimated and real-time research duration
- `email` scanner is available for reverse email exposure lookup
- `username` scan now performs deep profile research across direct platform profiles and best-effort public identity extraction
- optional Hudson Rock exposure intelligence is integrated for `username`, `email`, `number`, and `whois` scans
- tune depth via `PHOMBER_USERNAME_IDENTITY_SOURCES` (default: `20`)
- tune per-profile fetch timeout via `PHOMBER_PROFILE_FETCH_TIMEOUT` (default: `8` seconds)
- disable Hudson Rock checks with `PHOMBER_ENABLE_HUDSON_ROCK=0`
- tune Hudson Rock request timeout with `PHOMBER_HUDSON_ROCK_TIMEOUT` (default: `10` seconds)
- compatibility mode auto-enables on restricted runtimes (Termux/iSH/Android-like); override with `PHOMBER_COMPATIBILITY_MODE=1`
- Release windows (exe) & linux (lsb) direct executables, no python req.
- `v4` will have web-interface + automated scans features + (custom-scanner feature; create, distribute and deploy your own scanner)
```

### Troubleshooting

- Startup error: `Permission denied: '/proc/stat'`
- Use compatibility mode: `PHOMBER_COMPATIBILITY_MODE=1`
- Run with verbose diagnostics: `python3 phomber.py -e`

- Startup error: `No such file or directory`
- Run from project root (`phomber` directory)
- Reinstall dependencies: `pip3 install -r requirements.txt`

- Mobile shell runtimes (Termux/iSH) can be partially restricted
- Use Linux/Windows/macOS for full feature parity
- If you use mobile shells, include full `-e` output when reporting issues

### Credits

- Core author: `@s41r4j`
- Contributor: `@DkHrR`

</p>
