<p align=center>
         <img src='.images/phomber_logo.png'>
</p>


```
An open source infomation grathering & reconnaissance framework!
```

<p align=center>
         <a href='https://www.w3schools.in/ethical-hacking/information-gathering-techniques/'><img src="https://img.shields.io/badge/Etical Hacking-OSINT-yellow.svg?logo=sharp"></a>
         <a href='https://github.com/s41r4j/phomber/releases/'><img src="https://img.shields.io/badge/Version-v3.0-orange.svg?logo=vectorworks"></a>
         <a href='https://www.python.org/'><img src="https://img.shields.io/badge/Python-3-blue.svg?style=flat&logo=python"></a>
         <a href='LICENSE'><img src="https://img.shields.io/badge/License-GPL%20v3.0-brightgreen.svg"></a>
         <a href=''><img src="https://img.shields.io/badge/Disclaimer-With great power comes great responsibility-red.svg?logo=hackaday"></a>
</p>
      
<br>

<h1 align=center>PH0MBER: osint framework [3.0.9 (beta)]</h1>



<br>

## What is PH0MBER?

- `PH0MBER` is a tool which is used to gather information about a target which is publicly available
- Previously `PH0MBER` was a tool which was used to gather information about a phone number, but now it has been upgraded to a _framework_ with many _scanners_



<br>
<br>

## Install & Usage: A Quick Guide

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

- Help menu
```
    ┌────────────────────────────────────────────────────┐
    | COMMANDS      | DESCRIPTION                        |
    |----------------------------------------------------|
    |                <Basic Commands>                    |
    |----------------------------------------------------|
    | help          | Display this help menu             | 
    | exit/quit     | Exit the framework                 |
    | dork          | Show a random google dork query *  |  
    | exp           | Show info about all available      |       
    |               | expressions                        |
    | check         | Check internet connection          |
    | clear         | Clear screen                       |
    | save          | Save output of previous scanner    |
    |               | command in a file                  |
    | shell <cmd>   | Execute native shell/cmd commands  |
    | info          | Show info about framework & system |
    | change        | Change user command input color    |
    |----------------------------------------------------|
    |                 <Scanner Commands>                 |
    |----------------------------------------------------|
    | number        | Reverse phone number lookup *      |
    | ip            | Reverse ip address lookup *        |
    | mac           | Reverse mac address lookup         |
    | whois         | Reverse whois lookup *             |
    | dns           | Reverse or normal DNS lookup       |
    |----------------------------------------------------|
    | MORE SCANNERS COMING SOON, THIS IS A BETA VER      |
    └────────────────────────────────────────────────────┘
```

#### Pro tips:
- Type `help` to get a list of commands
- Type `help <command>` to see more info about a command
- Use `Tab` key to auto-complete commands
- Try silent mode by using `-s`/`--silent` flag
- You can also use `Ctrl+C` to exit
- Descriptions ending with `*` needs internet connection


<br>
<br>


### NOTES:
```
- `PH0MBER` is back with all new features and user interface
- `v3` has osint tools with no _api key_ requirement
- Currently this `v3.0-beta` is for testing, try using & report bugs
```
