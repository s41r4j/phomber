## This is an _unreleased_ source code of _ph0mber v3_


- you can build local version with `python install setup.py`
- need apikeys in config 
- tested for `linux`
- to display usage menu, just type `phomber` 
 
 
 
### For testing, you can try (copy-paste in terminal) the following:
 ```bash
 git clone https://github.com/s41r4j/phomber/
 cd ./phomber/.archive/unreleasedv3
 python3 setup.py install
 ```
- if there is some setuptools error, try running this `sudo python3 setup.py install`


### Usage

```
usage: phomber [-h] [-c] [-l] [-a] [-abs] [-lyr] [-fnt] [-nlu] [-vp]
               [Phone Number]

PH0MBER — reverse phone number lookup

positional arguments:
  Phone Number          Phone number to which perform reverse lookup

optional arguments:
  -h, --help            show this help message and exit
  -c, --config_editor   Opens config editor for entering apis keys
  -l, --logo            Display random `PH0MBER` logo
  -a, --all_apis        Run all API scans
  -abs, --abstractapi   Abstract Api [abstractapi.com]
  -lyr, --apilayer      Apilayer [apilayer.com]
  -fnt, --findandtrace  Find and Trace [findandtrace.com]
  -nlu, --numlookupapi  Numlookup Api [numlookupapi.com]
  -vp, --veriphone      Veriphone [veriphone.io]
```

<br>

> To uninstall, type `pip uninstall phomber` (use prefix `sudo`, if needed)
