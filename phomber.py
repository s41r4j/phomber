#!/usr/bin/python3

#==============================================================================#
#                                                                              #
# [prog]   : PH0MBER                                                           #
# [ver]    : 3.1.1                                                             #
# [desc]   : An open source infomation grathering & reconnaissance framework!  #
# [dev]    : @s41r4j                                                           #
# [license]: GNU GPLv3                                                         #
# [github] : https://github.com/s41r4j/phomber                                 #
# [pypi]   : https://pypi.org/project/phomber/                                 #
#                                                                              #
#==============================================================================#

#==============================================================================#
#                                                                              #
#   [!] Legal/Ethical disclaimer:                                              #
#                                                                              #
#   > Phomber is a tool designed to grather information about a target         #
#     which is publicly available.                                             #
#   > Usage of `ph0mber` for attacking targets without prior mutual            #
#     consent is illegal.                                                      #
#   > It is the end user's responsibility to obey all applicable               #
#     local, state and federal laws.                                           #
#   > Developers assume no liability and are not responsible for any misuse    #
#     or damage caused by this program.                                        #
#                                                                              #
#==============================================================================#


# ------------------------ Importing modules ------------------------ #
import requests      # Default
import os            # Default
import sys           # Default
import random        # Default
import time          # Default
import threading     # Default
import json          # Default
import importlib.util # Default
import re            # Default
import uuid          # Default
import socket        # Default
import platform      # Default
import getpass       # Default
import ipaddress     # Default (for IP validation)
from urllib.parse import quote_plus
import psutil        # pip install psutil
import bs4           # pip install beautifulsoup4
import phonenumbers  # pip install phonenumbers
from mac_vendor_lookup import MacLookup # pip install mac-vendor-lookup
import whois         # pip install python-whois
import dns.resolver  # pip install dnspython
from prompt_toolkit import prompt # pip install prompt_toolkit
from prompt_toolkit.completion import WordCompleter
from prompt_toolkit.formatted_text import ANSI
from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.history import InMemoryHistory
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory


# ------------------------ Utility functions ------------------------ #
def pad_string(value, width):
    """Safely pad a string to a given width without crashing on overflow."""
    value_str = str(value)
    padding = max(0, width - len(value_str))
    return value_str + ' ' * padding


def is_valid_ipv4(ip_address):
    """Validate IPv4 addresses properly (rejects 999.999.999.999, etc.)."""
    try:
        ipaddress.IPv4Address(ip_address)
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


def normalize_scan_target(raw_value):
    """Normalize scanner target values and allow optional `check` keyword."""
    value = raw_value.strip()
    if value.lower().startswith('check '):
        value = value[6:].strip()
    elif value.lower() == 'check':
        value = ''
    return value


def env_flag(name, default=False):
    """Parse common boolean env values safely."""
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return str(raw_value).strip().lower() in ['1', 'true', 'yes', 'on', 'enable', 'enabled']


def safe_float_env(name, default_value):
    """Read a float env var with a sane fallback."""
    try:
        return float(os.environ.get(name, str(default_value)))
    except (TypeError, ValueError):
        return float(default_value)


def safe_int_env(name, default_value):
    """Read an int env var with a sane fallback."""
    try:
        return int(os.environ.get(name, str(default_value)))
    except (TypeError, ValueError):
        return int(default_value)


def detect_runtime_profile():
    """Detect restricted/mobile environments where startup metrics often fail."""
    system_name = str(platform.system()).strip().lower()
    node_name = str(platform.node()).strip().lower()
    release_name = str(platform.release()).strip().lower()
    version_name = str(platform.version()).strip().lower()

    termux_detected = bool(
        os.environ.get('TERMUX_VERSION')
        or str(os.environ.get('PREFIX', '')).strip().startswith('/data/data/com.termux')
    )
    android_detected = bool(termux_detected or os.environ.get('ANDROID_ROOT') or os.environ.get('ANDROID_DATA') or 'android' in f'{system_name} {release_name} {version_name}')
    ish_detected = bool('ish' in f'{node_name} {release_name} {version_name}')

    proc_stat_readable = None
    if os.path.exists('/proc/stat'):
        try:
            with open('/proc/stat', 'r', encoding='utf-8', errors='ignore') as proc_stat_file:
                proc_stat_file.readline()
            proc_stat_readable = True
        except (PermissionError, OSError):
            proc_stat_readable = False

    restricted_runtime = bool(termux_detected or android_detected or ish_detected or proc_stat_readable is False)
    profile_label = 'standard'
    if termux_detected:
        profile_label = 'termux'
    elif ish_detected:
        profile_label = 'ish'
    elif android_detected:
        profile_label = 'android'

    return {
        'profile': profile_label,
        'is_termux': termux_detected,
        'is_android': android_detected,
        'is_ish': ish_detected,
        'proc_stat_readable': proc_stat_readable,
        'is_restricted': restricted_runtime,
    }


def style_info_field(value, width):
    """Color and pad system info fields without negative-padding crashes."""
    value_text = str(value)
    return '\33[1;49;96m' + value_text + '\033[0m' + ' ' * max(0, width - len(value_text))


def safe_metric_percent(metric_name, collector, warnings):
    """Collect a metric percent safely and record a warning when unavailable."""
    try:
        metric_value = collector()
        if metric_value is None:
            raise ValueError('metric collector returned None')
        return f'{float(metric_value):.1f}%'
    except Exception as error:
        warnings.append(f'{metric_name} unavailable: {error}')
        return 'N/A'


def build_system_snapshot():
    """Build robust system metrics with compatibility fallbacks."""
    runtime_profile = detect_runtime_profile()
    warnings = []

    if runtime_profile.get('proc_stat_readable') is False:
        warnings.append('restricted /proc/stat access detected; CPU metrics may be unavailable')

    disk_target = os.path.abspath(os.sep)
    if not os.path.exists(disk_target):
        disk_target = os.getcwd()

    ram_usage = safe_metric_percent('RAM usage', lambda: psutil.virtual_memory().percent, warnings)
    cpu_usage = safe_metric_percent('CPU usage', lambda: psutil.cpu_percent(), warnings)
    disk_usage = safe_metric_percent('Disk usage', lambda: psutil.disk_usage(disk_target).percent, warnings)

    return {
        'runtime_profile': runtime_profile,
        'ram_usage': ram_usage,
        'cpu_usage': cpu_usage,
        'disk_usage': disk_usage,
        'warnings': warnings,
    }


def detect_missing_runtime_dependencies():
    """Identify missing top-level modules for startup diagnostics."""
    dependency_map = [
        ('requests', 'requests'),
        ('prompt_toolkit', 'prompt_toolkit'),
        ('psutil', 'psutil'),
        ('bs4', 'beautifulsoup4'),
        ('phonenumbers', 'phonenumbers'),
        ('mac_vendor_lookup', 'mac-vendor-lookup'),
        ('whois', 'python-whois'),
        ('dns', 'dnspython'),
    ]
    missing_packages = []
    for module_name, package_name in dependency_map:
        if importlib.util.find_spec(module_name) is None:
            missing_packages.append(package_name)
    return missing_packages


def build_startup_diagnostics(error):
    """Create actionable diagnostics for startup failures."""
    runtime_profile = detect_runtime_profile()
    missing_packages = detect_missing_runtime_dependencies()

    diagnostic_items = [
        ('OS', platform.platform()),
        ('Python', platform.python_version()),
        ('Executable', sys.executable),
        ('Current Directory', os.getcwd()),
        ('Runtime Profile', runtime_profile.get('profile', 'unknown')),
        ('Compatibility Mode', str(PHOMBER_COMPATIBILITY_MODE)),
    ]

    suggestions = [
        'Install dependencies: pip3 install -r requirements.txt',
        'Use `python3 phomber.py -e` to show verbose trace details',
    ]

    error_text = str(error).lower()
    if '/proc/stat' in error_text or isinstance(error, PermissionError):
        suggestions.append('Restricted `/proc/stat` detected: run on full Linux/Windows/macOS or enable compatibility mode: PHOMBER_COMPATIBILITY_MODE=1')
    if isinstance(error, FileNotFoundError):
        suggestions.append('Run command from repository root and verify required files exist')
    if runtime_profile.get('is_restricted'):
        suggestions.append('Termux/iSH/Android runtimes may need extra permissions and can have partial feature support')

    if missing_packages:
        suggestions.append('Missing packages: ' + ', '.join(missing_packages))

    return diagnostic_items, suggestions


def print_startup_diagnostics(error):
    """Print startup diagnostics in a user-friendly way."""
    diagnostic_items, suggestions = build_startup_diagnostics(error)
    printit('[+] Startup diagnostics:', coledt=[1, 49, 93], space_up=True)
    for key_name, key_value in diagnostic_items:
        printit(f'    > {key_name}: {key_value}', coledt=[1, 49, 97])

    printit('[+] Suggested fixes:', coledt=[1, 49, 93], space_up=True)
    for suggestion in suggestions:
        printit(f'    > {suggestion}', coledt=[1, 49, 92])


def get_research_time_estimate(scanner_name):
    """Return estimated duration range for each scanner."""
    estimate_map = {
        'number': '5-15 seconds',
        'email': '4-20 seconds',
        'ip': '3-12 seconds',
        'mac': '1-5 seconds',
        'whois': '4-20 seconds',
        'dns': '2-10 seconds',
        'username': '20-300 seconds',
    }
    return estimate_map.get(scanner_name, '3-30 seconds')


def get_research_time_estimate_seconds(scanner_name):
    """Return average estimated duration (seconds) for live remaining-time updates."""
    estimate_seconds_map = {
        'number': 10,
        'email': 10,
        'ip': 8,
        'mac': 3,
        'whois': 12,
        'dns': 6,
        'username': 160,
    }
    return float(estimate_seconds_map.get(scanner_name, 16))


def _can_render_live_progress():
    """Return True when stdout supports TTY-style live progress rendering."""
    try:
        return hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()
    except Exception:
        return False


def _clear_live_progress_line():
    """Clear the current live progress line if one is rendered."""
    if not _can_render_live_progress():
        return
    sys.stdout.write('\r' + (' ' * 140) + '\r')
    sys.stdout.flush()


def _start_live_scan_progress(scanner_name, started_at, estimate_seconds):
    """Start a background ticker that updates elapsed and estimated remaining time."""
    if not _can_render_live_progress():
        return None

    stop_event = threading.Event()

    def _worker():
        while not stop_event.wait(1.0):
            elapsed_seconds = max(0.0, time.perf_counter() - started_at)
            remaining_seconds = max(0.0, estimate_seconds - elapsed_seconds)
            status_line = (
                f'    [+] {scanner_name} scan running | '
                f'elapsed: {elapsed_seconds:6.1f}s | '
                f'est remaining: {remaining_seconds:6.1f}s'
            )
            sys.stdout.write('\r\33[1;49;93m' + status_line.ljust(140) + '\033[0m')
            sys.stdout.flush()

        _clear_live_progress_line()

    timer_thread = threading.Thread(target=_worker, daemon=True)
    timer_thread.start()

    return {
        'stop_event': stop_event,
        'thread': timer_thread,
        'estimate_seconds': estimate_seconds,
    }


def announce_scan_timing(scanner_name, started_at=None):
    """Print estimate and start real-time remaining-time updates for this scanner."""
    estimate_text = get_research_time_estimate(scanner_name)
    estimate_seconds = get_research_time_estimate_seconds(scanner_name)
    printit(f'    [+] Estimated research time: {estimate_text} (real-time)', coledt=[1, 49, 93], space_down=True)

    previous_state = _active_scan_timers.pop(scanner_name, None)
    if previous_state:
        previous_state['stop_event'].set()
        previous_state['thread'].join(timeout=0.3)
        _clear_live_progress_line()

    if started_at is None:
        started_at = time.perf_counter()

    live_timer_state = _start_live_scan_progress(scanner_name, started_at, estimate_seconds)
    if live_timer_state:
        _active_scan_timers[scanner_name] = live_timer_state

    return estimate_text


def complete_scan_timing(scanner_name, started_at, result):
    """Stop live timer updates, print final timing summary, and return result."""
    timer_state = _active_scan_timers.pop(scanner_name, None)
    estimate_seconds = get_research_time_estimate_seconds(scanner_name)
    if timer_state:
        estimate_seconds = float(timer_state.get('estimate_seconds', estimate_seconds))
        timer_state['stop_event'].set()
        timer_state['thread'].join(timeout=0.3)
        _clear_live_progress_line()

    elapsed_seconds = max(0.0, time.perf_counter() - started_at)
    variance_seconds = elapsed_seconds - estimate_seconds
    printit(
        f'    [+] Real-time research time ({scanner_name}): {elapsed_seconds:.2f}s | estimated remaining: 0.00s | variance: {variance_seconds:+.2f}s',
        coledt=[1, 49, 96],
        space_down=True,
    )
    return result


# ------------------------ Global variables ------------------------ #
try: session = PromptSession(history=FileHistory('./.ph0mber_history'))
except: session = PromptSession(history=InMemoryHistory())
available_commands = ['change', 'check', 'clear', 'dns', 'dork', 'email', 'exit', 'exp', 'hash','help', 'info', 'ip', 'mac', 'number', 'quit', 'save', 'shell', 'username', 'whois']
prv_op = ''
full_cmd = ''
PHOMBER_NUMLOOKUP_API_KEY = (
    os.environ.get('PHOMBER_NUMLOOKUP_API_KEY', '').strip()
    or os.environ.get('NUMLOOKUP_API_KEY', '').strip()
)
PHOMBER_SHERLOCK_DATA_URL = (
    os.environ.get('PHOMBER_SHERLOCK_DATA_URL', '').strip()
    or 'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json'
)
try:
    PHOMBER_USERNAME_SITE_LIMIT = int(os.environ.get('PHOMBER_USERNAME_SITE_LIMIT', '80'))
except (TypeError, ValueError):
    PHOMBER_USERNAME_SITE_LIMIT = 80
try:
    PHOMBER_USERNAME_IDENTITY_SOURCES = int(os.environ.get('PHOMBER_USERNAME_IDENTITY_SOURCES', '20'))
except (TypeError, ValueError):
    PHOMBER_USERNAME_IDENTITY_SOURCES = 20
if PHOMBER_USERNAME_IDENTITY_SOURCES < 1:
    PHOMBER_USERNAME_IDENTITY_SOURCES = 1
try:
    PHOMBER_PROFILE_FETCH_TIMEOUT = float(os.environ.get('PHOMBER_PROFILE_FETCH_TIMEOUT', '8'))
except (TypeError, ValueError):
    PHOMBER_PROFILE_FETCH_TIMEOUT = 8.0
PHOMBER_ENABLE_HUDSON_ROCK = env_flag('PHOMBER_ENABLE_HUDSON_ROCK', default=True)
PHOMBER_HUDSON_ROCK_TIMEOUT = safe_float_env('PHOMBER_HUDSON_ROCK_TIMEOUT', 10)
PHOMBER_COMPATIBILITY_MODE = env_flag('PHOMBER_COMPATIBILITY_MODE', default=detect_runtime_profile().get('is_restricted', False))
_sherlock_site_cache = None
_active_scan_timers = {}
silent_mode = False



# ------------------------ Scanner functions ------------------------ #

# Check internet connection
def check_connection():
    # Checking internet connection
    urls = ['https://google.com', 'https://bing.com']
    try:
        requests.get(random.choice(urls), timeout=10)
        return True
    except:
        return False

# Reverse phone number lookup
def number_lookup(phone_number):
    # Importing modules
    from phonenumbers import timezone
    from phonenumbers import carrier
    from phonenumbers import geocoder
    
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    phone_number = normalize_scan_target(phone_number)
    started_at = time.perf_counter()
    announce_scan_timing('number', started_at)

    def finalize_scan(result):
        return complete_scan_timing('number', started_at, result)

    # Information gathering about the number
    printit(f'    [+] Grathering information about \33[1;49;96m{phone_number}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'\n    \33[1;49;93m[#] Reverse phone number lookup for \33[1;49;96m{phone_number}\33[1;49;93m:\033[0m'+'\n\n'

    # Check if the number is valid or not (regex)
    if not re.match(r'^\+[1-9]\d{1,14}$', phone_number):
        printit('    > Invalid phone number format! (Example: +44xxxxxxxxxx)', coledt=[1, 49, 91])
        return finalize_scan(False)

    # API-first lookup (Numlookup), fallback to local basic scanner.
    if PHOMBER_NUMLOOKUP_API_KEY:
        if check_connection():
            headers = {
                'apikey': PHOMBER_NUMLOOKUP_API_KEY,
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
            }
            try:
                response = requests.get(
                    f'https://api.numlookupapi.com/v1/validate/{phone_number}',
                    headers=headers,
                    timeout=15,
                )
                if response.status_code == 200:
                    response_json = response.json()

                    valid = bool(response_json.get('valid', False))
                    country_code = pad_string(str(response_json.get('country_code') or response_json.get('country_prefix') or 'N/A'), 30)
                    country = pad_string(str(response_json.get('country_name') or response_json.get('country') or 'N/A'), 30)
                    location = pad_string(str(response_json.get('location') or response_json.get('region') or 'N/A'), 30)
                    provider = pad_string(str(response_json.get('carrier') or response_json.get('operator') or 'N/A'), 30)
                    line_type = pad_string(str(response_json.get('line_type') or response_json.get('type') or 'N/A'), 30)
                    scanned_phone = pad_string(str(phone_number), 30)
                    international = pad_string(str(response_json.get('international_format') or phone_number), 30)
                    national = pad_string(str(response_json.get('local_format') or response_json.get('national_format') or 'N/A'), 30)
                    valid_text = pad_string(str(valid), 30)

                    final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned Phone Number: \33[1;49;96m{scanned_phone}\033[0m |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mValid\033[0m               | {valid_text} |
    |------------------------------------------------------|
    | \33[1;49;97mCountry Code\033[0m        | {country_code} |
    | \33[1;49;97mCountry\033[0m             | {country} |
    | \33[1;49;97mLocation\033[0m            | {location} |
    | \33[1;49;97mCarrier\033[0m             | {provider} |
    | \33[1;49;97mLine Type\033[0m           | {line_type} |
    |------------------------------------------------------|
    | \33[1;49;97mInternational Format\033[0m| {international} |
    | \33[1;49;97mNational Format\033[0m     | {national} |
    |------------------------------------------------------|
    | \33[1;49;97mSource\033[0m              | Numlookup API                  |
    └──────────────────────────────────────────────────────┘
                    '''
                    print(final_output)
                    prv_op += final_output+'\n'
                    return finalize_scan(valid)
            except (requests.RequestException, ValueError, TypeError):
                pass

        printit('    > API lookup unavailable, using basic local lookup...', coledt=[1, 49, 93], space_down=True)
    
    # Country code check
    try:
        # Phone number format: (+Countrycode)xxxxxxxxxx
        phone_number_details = phonenumbers.parse(phone_number)
    except phonenumbers.phonenumberutil.NumberParseException:
        printit('    > Missing Country Code! (Example: +91, +44, +1)', coledt=[1, 49, 91])
        return finalize_scan(False)

    # extract country_code & only_number from "Country Code: xx National Number: xxxxxxxxxx"
    country_code = str(phone_number_details).split('Country Code:', 1)[1].split('National Number:', 1)[0].strip()
    only_number = str(phone_number_details).split('Country Code:', 1)[1].split('National Number:', 1)[1].strip()
    
    # Validating a phone number
    valid = phonenumbers.is_valid_number(phone_number_details)

    # Checking possibility of a number
    possible = phonenumbers.is_possible_number(phone_number_details)

    if valid and possible:
        # Creating a phone number variable for country
        counrty_number = phonenumbers.parse(phone_number,'CH')

        # Gives mobile number's location (Region)
        region_code = phonenumbers.region_code_for_number(phone_number_details)

        # Gives mobile number's location (Country)
        country = geocoder.description_for_number(counrty_number, 'en')

        # Creating a phone number variable for service provider
        service_number = phonenumbers.parse(phone_number,'RO')

        # Gives mobile number's service provider (Airtel, Idea, Jio)
        service_provider = carrier.name_for_number(service_number, 'en')

        # Gives mobile number's timezone
        timezone_details_unfiltered = str(timezone.time_zones_for_number(phone_number_details))
        timezone_details = timezone_details_unfiltered.replace('[', '').replace(']', '').replace("'", '').replace('(', '').replace(')', '').replace(',', '').replace(' ', '')
        
        # RFC3966 Format
        r_format = phonenumbers.format_number(phone_number_details, phonenumbers.PhoneNumberFormat.RFC3966).replace('tel:', '')

        # Reconfiguring variables
        possible = str(possible)+' '*int(30-len(str(possible)))
        valid = str(valid)+' '*int(30-len(str(valid)))
        country_code = str(country_code)+' '*int(30-len(str(country_code)))
        country = str(country)+' '*int(30-len(str(country)))
        region_code = str(region_code)+' '*int(30-len(str(region_code)))
        service_provider = str(service_provider)+' '*int(30-len(str(service_provider)))
        timezone_details = str(timezone_details)+' '*int(30-len(str(timezone_details)))
        phone_number = str(phone_number)+' '*int(30-len(str(phone_number)))
        only_number = str(only_number)+' '*int(30-len(str(only_number)))
        r_format = str(r_format)+' '*int(30-len(str(r_format)))
        
        # Printing information
        final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned Phone Number: \33[1;49;96m{phone_number}\033[0m |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mPossible\033[0m            | {possible} |
    | \33[1;49;97mValid\033[0m               | {valid} |
    |------------------------------------------------------|
    | \33[1;49;97mCountry Code\033[0m        | {country_code} |
    | \33[1;49;97mCountry\033[0m             | {country} |
    | \33[1;49;97mRegion Code\033[0m         | {region_code} |
    | \33[1;49;97mService Provider\033[0m    | {service_provider} |
    | \33[1;49;97mTimezone\033[0m            | {timezone_details} |
    |------------------------------------------------------|
    | \33[1;49;97mInternational Format\033[0m| {phone_number} |
    | \33[1;49;97mNational Format\033[0m     | {only_number} |
    | \33[1;49;97mRFC3966 Format\033[0m      | {r_format} |
    └──────────────────────────────────────────────────────┘
        '''
        print(final_output)
        prv_op += final_output+'\n'

        # Online free lookup services
        online_free_lookup = f'''
    \33[1;49;93m[+] Searching for \33[1;49;96m{phone_number.strip()}\33[1;49;93m on various platforms:

    \33[1;49;92m> https://www.ipqualityscore.com/reverse-phone-number-lookup/lookup/{region_code.strip()}/{only_number.strip()}
    > https://www.truecaller.com/search/{region_code.strip().lower()}/{only_number.strip()}
    \033[0m'''
        print(online_free_lookup)
        prv_op += online_free_lookup+'\n'

        # Google Dork Query to find more information about the number
        google_dork_queries = f'''
    \33[1;49;93m[+] Search engine lookup:

    \33[1;49;92m> https://www.google.com/search?q={only_number.strip()}
    > https://www.google.com/search?q={phone_number.strip()}
    > https://www.bing.com/search?q={only_number.strip()}
    > https://www.bing.com/search?q={phone_number.strip()}
    > https://duckduckgo.com/?q={only_number.strip()}
    > https://duckduckgo.com/?q={phone_number.strip()}
    \033[0m'''
        print(google_dork_queries)
        prv_op += google_dork_queries+'\n'

        # Scanning social media platforms
        social_media_platforms = f'''
    \33[1;49;93m[+] Scanning social media platforms:

    \33[1;49;92m> https://www.facebook.com/search/top?q={only_number.strip()}
    > https://www.facebook.com/search/top?q={phone_number.strip()}
    > https://www.instagram.com/{only_number.strip()}
    > https://www.instagram.com/{phone_number.strip()}
    > https://www.twitter.com/{only_number.strip()}
    > https://www.twitter.com/{phone_number.strip()}
    > https://www.linkedin.com/search/results/all/?keywords={only_number.strip()}
    > https://www.linkedin.com/search/results/all/?keywords={phone_number.strip()}
    > https://www.pinterest.com/search/pins/?q={only_number.strip()}
    > https://www.pinterest.com/search/pins/?q={phone_number.strip()}
    > https://www.tumblr.com/search/{only_number.strip()}
    > https://www.tumblr.com/search/{phone_number.strip()}
    > https://www.youtube.com/results?search_query={only_number.strip()}
    > https://www.youtube.com/results?search_query={phone_number.strip()}
    \033[0m'''
        print(social_media_platforms)
        prv_op += social_media_platforms+'\n'

        hudson_output, _ = run_hudson_rock_section('phone', phone_number.strip())
        if hudson_output:
            print(hudson_output)
            prv_op += hudson_output+'\n'

        return finalize_scan(True)
        
    else:
        # Reconfiguring variables
        possible = str(possible)+' '*int(30-len(str(possible)))
        valid = str(valid)+' '*int(30-len(str(valid)))
        phone_number = str(phone_number)+' '*int(30-len(str(phone_number)))

        final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned Phone Number: \33[1;49;96m{phone_number}\033[0m |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mPossible\033[0m            | {possible} |
    | \33[1;49;97mValid\033[0m               | {valid} |
    └──────────────────────────────────────────────────────┘
        '''
        print(final_output)
        prv_op += final_output+'\n'
        return finalize_scan(False)

# Reverse ip address lookup
def ip_lookup(ip_address):
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    ip_address = normalize_scan_target(ip_address)
    started_at = time.perf_counter()
    announce_scan_timing('ip', started_at)

    def finalize_scan(result):
        return complete_scan_timing('ip', started_at, result)
    
    # Checking internet connection
    printit(f'    [+] Verifying internet connection...', coledt=[1, 49, 93], space_down=True)
    if not check_connection():
        printit('    > Internet connection not available!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    # Information gathering about the ip address
    printit(f'    [+] Grathering information about \33[1;49;96m{ip_address}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'    \33[1;49;93m[#] Reverse ip address lookup for \33[1;49;96m{ip_address}\33[1;49;93m:\033[0m'+'\n\n'

    # Check if the ip address is valid or not (regex) [add IPv6 support]
    if not is_valid_ipv4(ip_address):
        printit('    > Invalid ip address format! (Example: 8.8.8.8)', coledt=[1, 49, 91])
        return finalize_scan(False)

    # IP address lookup APIs
    ip_addresses = [f'https://ip-api.com/json/{ip_address}', f'https://ipapi.co/{ip_address}/json/', f'https://ipwho.is/{ip_address}']
    ip_address = str(ip_address)+' '*int(30-len(str(ip_address)))

    # Headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
    }

    # Optional token-based source (if PHOMBER_IPINFO_TOKEN/IPINFO_TOKEN is configured).
    ipinfo_token = os.environ.get('PHOMBER_IPINFO_TOKEN', '').strip() or os.environ.get('IPINFO_TOKEN', '').strip()
    if ipinfo_token:
        try:
            response = requests.get(
                f'https://ipinfo.io/{normalize_scan_target(ip_address)}/json',
                params={'token': ipinfo_token},
                timeout=10,
                headers=headers,
            )
            response_json = response.json()

            if response.status_code == 200 and 'error' not in response_json and 'bogon' not in response_json:
                ip = str(response_json.get('ip', 'N/A'))
                city = str(response_json.get('city', 'N/A'))
                region = str(response_json.get('region', 'N/A'))
                country = str(response_json.get('country', 'N/A'))
                timezone = str(response_json.get('timezone', 'N/A'))
                postal = str(response_json.get('postal', 'N/A'))
                org = str(response_json.get('org', 'N/A'))
                hostname = str(response_json.get('hostname', 'N/A'))
                loc = str(response_json.get('loc', 'N/A'))

                ip = str(ip)+' '*int(30-len(str(ip)))
                city = str(city)+' '*int(30-len(str(city)))
                region = str(region)+' '*int(30-len(str(region)))
                country = str(country)+' '*int(30-len(str(country)))
                timezone = str(timezone)+' '*int(30-len(str(timezone)))
                postal = str(postal)+' '*int(30-len(str(postal)))
                org = str(org)+' '*int(30-len(str(org)))
                hostname = str(hostname)+' '*int(30-len(str(hostname)))
                loc = str(loc)+' '*int(30-len(str(loc)))

                final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mIP\033[0m                  | {ip} |
    | \33[1;49;97mCountry\033[0m             | {country} |
    | \33[1;49;97mRegion\033[0m              | {region} |
    | \33[1;49;97mCity\033[0m                | {city} |
    |------------------------------------------------------|
    | \33[1;49;97mPostal Code\033[0m         | {postal} |
    | \33[1;49;97mTimezone\033[0m            | {timezone} |
    | \33[1;49;97mCoordinates\033[0m         | {loc} |
    |------------------------------------------------------|
    | \33[1;49;97mOrg\033[0m                 | {org} |
    | \33[1;49;97mHostname\033[0m            | {hostname} |
    └──────────────────────────────────────────────────────┘
    '''
                print(final_output)
                prv_op += final_output+'\n'
                return finalize_scan(True)
        except (requests.RequestException, ValueError, KeyError, AttributeError, IndexError, TypeError):
            pass
    
    # Randomizing ip address lookup APIs
    random_api = random.choice([0, 1, 2])

    # ip_addresses[0]
    if random_api == 0:
        try:
            # Getting response
            response = requests.get(ip_addresses[0], timeout=10, headers=headers)
            response_json = response.json()

            # Extracting data
            if response.status_code == 200 and response_json['status'] == 'success':
                country = response_json['country']
                countryCode = response_json['countryCode']
                region = response_json['regionName']
                regionCode = response_json['region']
                city = response_json['city']
                isp = response_json['isp']
                org = response_json['org']
                timezone = response_json['timezone']
                postal = response_json['zip']
                latitude = response_json['lat']
                longitude = response_json['lon']
                ip = response_json['query']
            else:
                raise Exception('reverse-ip-lookup-server-1-error')

            # Reconfiguring variables
            country = str(country)+' '*int(30-len(str(country)))
            countryCode = str(countryCode)+' '*int(30-len(str(countryCode)))
            region = str(region)+' '*int(30-len(str(region)))
            regionCode = str(regionCode)+' '*int(30-len(str(regionCode)))
            city = str(city)+' '*int(30-len(str(city)))
            isp = str(isp)+' '*int(30-len(str(isp)))
            org = str(org)+' '*int(30-len(str(org)))
            timezone = str(timezone)+' '*int(30-len(str(timezone)))
            postal = str(postal)+' '*int(30-len(str(postal)))
            latitude = str(latitude)+' '*int(30-len(str(latitude)))
            longitude = str(longitude)+' '*int(30-len(str(longitude)))
            ip = str(ip)+' '*int(30-len(str(ip)))
            
            # Printing information
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mCountry\033[0m             | {country} |
    | \33[1;49;97mCountry Code\033[0m        | {countryCode} |
    | \33[1;49;97mRegion\033[0m              | {region} |
    | \33[1;49;97mRegion Code\033[0m         | {regionCode} |
    | \33[1;49;97mCity\033[0m                | {city} |
    |------------------------------------------------------|
    | \33[1;49;97mPostal Code\033[0m         | {postal} |
    | \33[1;49;97mTimezone\033[0m            | {timezone} |
    | \33[1;49;97mLatitude\033[0m            | {latitude} |
    | \33[1;49;97mLongitude\033[0m           | {longitude} |
    |------------------------------------------------------|
    | \33[1;49;97mISP\033[0m                 | {isp} |
    | \33[1;49;97mOrg\033[0m                 | {org} |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

        except Exception as e:
            print(e)
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | \33[1;49;91mFailed to Fetch information from this server!\033[0m        |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

    # ip_addresses[1]
    elif random_api == 1:
        try:
            # Getting response_json
            response = requests.get(ip_addresses[1], timeout=10, headers=headers)
            response_json = response.json()

            # Extracting data
            if response.status_code == 200:
                ip = response_json['ip']
                network = response_json['network']
                version = response_json['version']
                city = response_json['city']
                region = response_json['region']
                region_code = response_json['region_code']
                country = response_json['country_name']
                country_name = response_json['country_name']
                country_code = response_json['country_code']
                country_code_iso3 = response_json['country_code_iso3']
                country_capital = response_json['country_capital']
                country_tld = response_json['country_tld']
                continent_code = response_json['continent_code']
                in_eu = response_json['in_eu']
                postal = response_json['postal']
                latitude = response_json['latitude']
                longitude = response_json['longitude']
                timezone = response_json['timezone']
                utc_offset = response_json['utc_offset']
                country_calling_code = response_json['country_calling_code']
                currency = response_json['currency']
                currency_name = response_json['currency_name']
                languages = response_json['languages']
                country_area = response_json['country_area']
                country_population = response_json['country_population']
                asn = response_json['asn']
                org = response_json['org']
            else:
                raise Exception('reverse-ip-lookup-server-2-error')

            # Reconfiguring variables
            ip = str(ip)+' '*int(30-len(str(ip)))
            network = str(network)+' '*int(30-len(str(network)))
            version = str(version)+' '*int(30-len(str(version)))
            city = str(city)+' '*int(30-len(str(city)))
            region = str(region)+' '*int(30-len(str(region)))
            region_code = str(region_code)+' '*int(30-len(str(region_code)))
            country = str(country)+' '*int(30-len(str(country)))
            country_name = str(country_name)+' '*int(30-len(str(country_name)))
            country_code = str(country_code)+' '*int(30-len(str(country_code)))
            country_code_iso3 = str(country_code_iso3)+' '*int(30-len(str(country_code_iso3)))
            country_capital = str(country_capital)+' '*int(30-len(str(country_capital)))
            country_tld = str(country_tld)+' '*int(30-len(str(country_tld)))
            continent_code = str(continent_code)+' '*int(30-len(str(continent_code)))
            in_eu = str(in_eu)+' '*int(30-len(str(in_eu)))
            postal = str(postal)+' '*int(30-len(str(postal)))
            latitude = str(latitude)+' '*int(30-len(str(latitude)))
            longitude = str(longitude)+' '*int(30-len(str(longitude)))
            timezone = str(timezone)+' '*int(30-len(str(timezone)))
            utc_offset = str(utc_offset)+' '*int(30-len(str(utc_offset)))
            country_calling_code = str(country_calling_code)+' '*int(30-len(str(country_calling_code)))
            currency = str(currency)+' '*int(30-len(str(currency)))
            currency_name = str(currency_name)+' '*int(30-len(str(currency_name)))
            languages = str(languages)+' '*int(30-len(str(languages)))
            country_area = str(country_area)+' '*int(30-len(str(country_area)))
            country_population = str(country_population)+' '*int(30-len(str(country_population)))
            asn = str(asn)+' '*int(30-len(str(asn)))
            org = str(org)+' '*int(30-len(str(org)))
            
            # Printing information
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mIP Type\033[0m             | {version} |
    | \33[1;49;97mNetwork\033[0m             | {network} |
    |------------------------------------------------------|
    | \33[1;49;97mCountry\033[0m             | {country} |
    | \33[1;49;97mCountry Name\033[0m        | {country_name} |
    | \33[1;49;97mCountry Code\033[0m        | {country_code} |
    | \33[1;49;97mCountry Code ISO3\033[0m   | {country_code_iso3} |
    | \33[1;49;97mCountry Capital\033[0m     | {country_capital} |
    | \33[1;49;97mRegion\033[0m              | {region} |
    | \33[1;49;97mRegion Code\033[0m         | {region_code} |
    | \33[1;49;97mCity\033[0m                | {city} |
    |------------------------------------------------------|
    | \33[1;49;97mCountry TLD\033[0m         | {country_tld} |
    | \33[1;49;97mCalling Prefix\033[0m      | {country_calling_code} |
    | \33[1;49;97mContinent Code\033[0m      | {continent_code} |
    | \33[1;49;97mIn EU\033[0m               | {in_eu} |
    | \33[1;49;97mApprox. Area\033[0m        | {country_area} |
    | \33[1;49;97mApprox. Population\033[0m  | {country_population} |
    | \33[1;49;97mLanguages Spoken\033[0m    | {languages} |
    | \33[1;49;97mCurrency\033[0m            | {currency} |
    | \33[1;49;97mCurrency Name\033[0m       | {currency_name} |
    |------------------------------------------------------|
    | \33[1;49;97mPostal Code\033[0m         | {postal} |
    | \33[1;49;97mLatitude\033[0m            | {latitude} |
    | \33[1;49;97mLongitude\033[0m           | {longitude} |
    | \33[1;49;97mTimezone\033[0m            | {timezone} |
    | \33[1;49;97mUTC Offset\033[0m          | {utc_offset} |
    |------------------------------------------------------|
    | \33[1;49;97mASN\033[0m                 | {asn} |
    | \33[1;49;97mISP\033[0m                 | {org} |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

        except (requests.RequestException, ValueError, KeyError, AttributeError, IndexError, TypeError) as e:
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | \33[1;49;91mFailed to Fetch information from this server!\033[0m        |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

    # ip_addresses[2]
    elif random_api == 2:
        try:
            # Getting response_json
            response = requests.get(ip_addresses[2], timeout=10, headers=headers)
            response_json = response.json()

            # Extracting data
            if response.status_code == 200 and response_json['success'] == True:
                ip = response_json['ip']
                ip_type = response_json['type']
                continent = response_json['continent']
                continent_code = response_json['continent_code']
                country = response_json['country']
                country_code = response_json['country_code']
                region = response_json['region']
                region_code = response_json['region_code']
                city = response_json['city']
                latitude = response_json['latitude']
                longitude = response_json['longitude']
                is_eu = response_json['is_eu']
                postal = response_json['postal']
                calling_code = response_json['calling_code']
                capital = response_json['capital']
                borders = response_json['borders']
                flag_img = response_json['flag']['img']
                flag_emoji = response_json['flag']['emoji']
                flag_emoji_unicode = response_json['flag']['emoji_unicode']
                asn = response_json['connection']['asn']
                org = response_json['connection']['org']
                isp = response_json['connection']['isp']
                domain = response_json['connection']['domain']
                timezone_id = response_json['timezone']['id']
                timezone_abbr = response_json['timezone']['abbr']
                timezone_is_dst = response_json['timezone']['is_dst']
                timezone_offset = response_json['timezone']['offset']
                timezone_utc = response_json['timezone']['utc']
                timezone_current_time = response_json['timezone']['current_time']
            else:
                raise Exception('reverse-ip-lookup-server-3-error')

            # Reconfiguring variables
            ip = str(ip)+' '*int(30-len(str(ip)))
            ip_type = str(ip_type)+' '*int(30-len(str(ip_type)))
            continent = str(continent)+' '*int(30-len(str(continent)))
            continent_code = str(continent_code)+' '*int(30-len(str(continent_code)))
            country = str(country)+' '*int(30-len(str(country)))
            country_code = str(country_code)+' '*int(30-len(str(country_code)))
            region = str(region)+' '*int(30-len(str(region)))
            region_code = str(region_code)+' '*int(30-len(str(region_code)))
            city = str(city)+' '*int(30-len(str(city)))
            latitude = str(latitude)+' '*int(30-len(str(latitude)))
            longitude = str(longitude)+' '*int(30-len(str(longitude)))
            is_eu = str(is_eu)+' '*int(30-len(str(is_eu)))
            postal = str(postal)+' '*int(30-len(str(postal)))
            calling_code = str(calling_code)+' '*int(30-len(str(calling_code)))
            capital = str(capital)+' '*int(30-len(str(capital)))
            borders = str(borders)+' '*int(30-len(str(borders)))
            flag_img = str(flag_img)+' '*int(30-len(str(flag_img)))
            flag_emoji = str(flag_emoji)+' '*int(30-len(str(flag_emoji)))
            flag_emoji_unicode = str(flag_emoji_unicode)+' '*int(30-len(str(flag_emoji_unicode)))
            asn = str(asn)+' '*int(30-len(str(asn)))
            org = str(org)+' '*int(30-len(str(org)))
            isp = str(isp)+' '*int(30-len(str(isp)))
            domain = str(domain)+' '*int(30-len(str(domain)))
            timezone_id = str(timezone_id)+' '*int(30-len(str(timezone_id)))
            timezone_abbr = str(timezone_abbr)+' '*int(30-len(str(timezone_abbr)))
            timezone_is_dst = str(timezone_is_dst)+' '*int(30-len(str(timezone_is_dst)))
            timezone_offset = str(timezone_offset)+' '*int(30-len(str(timezone_offset)))
            timezone_utc = str(timezone_utc)+' '*int(30-len(str(timezone_utc)))
            timezone_current_time = str(timezone_current_time)+' '*int(30-len(str(timezone_current_time)))
                    
            # Printing information
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mIP Type\033[0m             | {ip_type} |
    |------------------------------------------------------|
    | \33[1;49;97mCountry\033[0m             | {country} |
    | \33[1;49;97mCountry Code\033[0m        | {country_code} |
    | \33[1;49;97mRegion\033[0m              | {region} |
    | \33[1;49;97mRegion Code\033[0m         | {region_code} |
    | \33[1;49;97mCity\033[0m                | {city} |
    |------------------------------------------------------|
    | \33[1;49;97mCountry Capital\033[0m     | {capital} |
    | \33[1;49;97mContinent\033[0m           | {continent} |
    | \33[1;49;97mContinent Code\033[0m      | {continent_code} |
    | \33[1;49;97mIn EU\033[0m               | {is_eu} |
    | \33[1;49;97mSharing Border with\033[0m | {borders} |
    | \33[1;49;97mFlag Emoji\033[0m          | {flag_emoji_unicode} |
    |------------------------------------------------------|
    | \33[1;49;97mPostal Code\033[0m         | {postal} |
    | \33[1;49;97mCalling Prefix\033[0m      | {calling_code} |
    | \33[1;49;97mLatitude\033[0m            | {latitude} |
    | \33[1;49;97mLongitude\033[0m           | {longitude} |
    |------------------------------------------------------|
    | \33[1;49;97mTimezone\033[0m            | {timezone_id} |
    | \33[1;49;97mTimezone Abbr\033[0m       | {timezone_abbr} |
    | \33[1;49;97mTimezone is DST\033[0m     | {timezone_is_dst} |
    | \33[1;49;97mTimezone Offset\033[0m     | {timezone_offset} |
    | \33[1;49;97mTimezone UTC\033[0m        | {timezone_utc} |
    | \33[1;49;97mCurrent Time\033[0m        | {timezone_current_time} |
    |------------------------------------------------------|
    | \33[1;49;97mASN\033[0m                 | {asn} |
    | \33[1;49;97mISP\033[0m                 | {isp} |
    | \33[1;49;97mDomain\033[0m              | {domain} |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

        except (requests.RequestException, ValueError, KeyError, AttributeError, IndexError, TypeError) as e:
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    |------------------------------------------------------|
    | \33[1;49;91mFailed to Fetch information from this server!\033[0m        |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

    return finalize_scan(True)

# Reverse mac address lookup
def mac_lookup(mac_address):
    # https://api.macvendors.com/<mac_address>
    
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    started_at = time.perf_counter()
    announce_scan_timing('mac', started_at)

    def finalize_scan(result):
        return complete_scan_timing('mac', started_at, result)

    # Information gathering about the mac address
    printit(f'    [+] Grathering information about \33[1;49;96m{mac_address}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'    \33[1;49;93m[#] Reverse mac address lookup for \33[1;49;96m{mac_address}\33[1;49;93m:\033[0m'+'\n\n'

    # Check if the mac address is valid or not (regex)
    if not re.match(r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', mac_address) :
        printit('    > Invalid mac address format! (Example: 00:00:00:00:00:00)', coledt=[1, 49, 91])
        return finalize_scan(False)

    # Getting mac address vendor
    try:
        vendor = MacLookup().lookup(mac_address)
        bol_val = True
    except KeyError:
        vendor = '\33[1;49;91mNot Found\033[0m'
        bol_val = False

    # Reconfiguring variables
    mac_address = str(mac_address)+' '*int(31-len(str(mac_address)))
    vendor = str(vendor)+' '*int((36+14)-len(str(vendor)))

    # Printing information
    final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned MAC Address: \33[1;49;96m{mac_address}\033[0m |
    |------------------------------------------------------|
    | INFORMATION   | DESCRIPTION                          |
    |------------------------------------------------------|
    | \33[1;49;97mVendor\033[0m        | {vendor} |
    └──────────────────────────────────────────────────────┘
    '''
    print(final_output)
    prv_op += final_output+'\n'

    return finalize_scan(bol_val)

# Reverse whois lookup
def whois_lookup(domain):
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    started_at = time.perf_counter()
    announce_scan_timing('whois', started_at)

    def finalize_scan(result):
        return complete_scan_timing('whois', started_at, result)

    # Checking internet connection
    printit(f'    [+] Verifying internet connection...', coledt=[1, 49, 93], space_down=True)
    if not check_connection():
        printit('    > Internet connection not available!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    # Information gathering about the domain
    printit(f'    [+] Grathering information about \33[1;49;96m{domain}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'    \33[1;49;93m[#] Reverse whois lookup for \33[1;49;96m{domain}\33[1;49;93m:\033[0m'+'\n\n'

    # Domain validation (regex)
    if not re.match(r'^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$', domain) :
        printit('    > Invalid domain format! (Example: example.com)', coledt=[1, 49, 91])
        return finalize_scan(False)

    # Getting whois information
    try:
        whois_info = whois.whois(domain)
        bol_val = True
    except:
        bol_val = False

    # Reconfiguring variables
    domain = str(domain)+' '*int(36-len(str(domain)))

    # Printing information
    final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned Domain: \33[1;49;96m{domain}\033[0m |
    |------------------------------------------------------|
    | INFORMATION   | DESCRIPTION                          |
    |------------------------------------------------------|'''

    # If whois information is available
    if bol_val:
        # Loop through whois information & add it to the final output
        for key, value in whois_info.items():
            # Filtering out some keys
            if key == 'status': continue
            if key == 'expiration_date': key = 'expiry_date'
            if key == 'registrant_postal_code': key = 'postal_code'

            # Reconfiguring variables
            key = key.replace('_', ' ').capitalize()

            # Adding formatted information to the final output
            if type(value) == list:
                key = str(key)+' '*int(13-len(str(key)))
                value_1 = str(value[0])+' '*int(36-len(str(value[0])))
                final_output += f'''\n    | \33[1;49;97m{key}\033[0m | {value_1} |'''
                if len(value) > 1:
                    for i in range(1, len(value)):
                        value_2 = str(value[i])+' '*int(36-len(str(value[i])))
                        final_output += f'''\n    |               | {value_2} |'''
            else:
                key = str(key)+' '*int(13-len(str(key)))
                value = str(value)+' '*int(36-len(str(value)))
                final_output += f'''\n    | \33[1;49;97m{key}\033[0m | {value} |'''            
    else:
        final_output += f'''\n    | \33[1;49;97mInformation\033[0m   | \33[1;49;91mNot Found\033[0m{' '*int(36-len('Not Found'))} |'''

    # Add the last part of the final output
    final_output += f'''\n    └──────────────────────────────────────────────────────┘'''

    print(final_output)
    prv_op += final_output+'\n'

    hudson_output, _ = run_hudson_rock_section('domain', domain.strip())
    if hudson_output:
        print(hudson_output)
        prv_op += hudson_output+'\n'

    return finalize_scan(bol_val)

# Reverse domain lookup
def dns_lookup(ip_or_domain):
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    started_at = time.perf_counter()
    announce_scan_timing('dns', started_at)

    def finalize_scan(result):
        return complete_scan_timing('dns', started_at, result)

    # Checking internet connection
    printit(f'    [+] Verifying internet connection...', coledt=[1, 49, 93], space_down=True)
    if not check_connection():
        printit('    > Internet connection not available!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    # Information gathering about the domain    
    printit(f'    [+] Grathering information about \33[1;49;96m{ip_or_domain}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)

    # Validating ip address or domain name (regex)
    if re.match(r'^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$', ip_or_domain):
        prv_op += f'    \33[1;49;93m[#] DNS lookup for \33[1;49;96m{ip_or_domain}\33[1;49;93m:\033[0m'+'\n\n'
        domain = ip_or_domain + ' '*int(36-len(ip_or_domain))
        final_output_scanned = f'    | Scanned Domain: \33[1;49;96m{domain}\033[0m |'
        try:
            ip = socket.gethostbyname(ip_or_domain)
            ip = str(ip)+' '*int(36-len(str(ip)))
        except:
            ip = '\33[1;49;91mNot Found\033[0m' + ' '*int(36-len('Not Found'))
    elif re.match(r'^([0-9]{1,3}\.){3}[0-9]{1,3}$', ip_or_domain):
        prv_op += f'    \33[1;49;93m[#] Reverse DNS lookup for \33[1;49;96m{ip_or_domain}\33[1;49;93m:\033[0m'+'\n\n'
        ip = ip_or_domain + ' '*int(36-len(ip_or_domain))
        final_output_scanned = f'    | Scanned IP: \33[1;49;96m{ip}\033[0m     |'
        try:
            domain = socket.gethostbyaddr(ip_or_domain)[0]
            domain = str(domain)+' '*int(36-len(str(domain)))
        except:
            domain = '\33[1;49;91mNot Found\033[0m' + ' '*int(36-len('Not Found'))
    else:
        printit('    > Invalid ip address or domain name!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    # Excepts: socket.gaierror, socket.herror

    # Printing information
    final_output_remaining = f'''
    |------------------------------------------------------|
    | INFORMATION   | DESCRIPTION                          |
    |------------------------------------------------------|
    | \33[1;49;97mIP\033[0m            | {ip} |
    | \33[1;49;97mDomain\033[0m        | {domain} |
    └──────────────────────────────────────────────────────┘
    '''

    print('\n    ┌──────────────────────────────────────────────────────┐\n'+final_output_scanned+final_output_remaining)
    prv_op += '\n    ┌──────────────────────────────────────────────────────┐'+'\n'+final_output_scanned+final_output_remaining

    return finalize_scan(True)


def truncate_for_table(value, width):
    """Trim text for fixed-width table cells while preserving readability."""
    value_text = str(value)
    if len(value_text) <= width:
        return value_text
    if width <= 3:
        return value_text[:width]
    return value_text[:width - 3] + '...'


def load_sherlock_site_data():
    """Load Sherlock site manifest from a remote JSON source."""
    global _sherlock_site_cache
    if _sherlock_site_cache is not None:
        return _sherlock_site_cache

    headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'}
    try:
        response = requests.get(PHOMBER_SHERLOCK_DATA_URL, timeout=20, headers=headers)
        response.raise_for_status()
        response_json = response.json()
        _sherlock_site_cache = response_json if isinstance(response_json, dict) else {}
    except (requests.RequestException, ValueError, TypeError):
        _sherlock_site_cache = {}

    return _sherlock_site_cache


def sherlock_profile_check(site_data, username, headers):
    """Check a single Sherlock site entry and return existence + profile URL."""
    if not isinstance(site_data, dict):
        return False, None
    if site_data.get('disabled', False):
        return False, None

    url_template = str(site_data.get('url', '')).strip()
    probe_template = str(site_data.get('urlProbe', '')).strip()
    if not url_template:
        return False, None

    try:
        profile_url = url_template.format(username)
    except (IndexError, KeyError, ValueError):
        return False, None

    probe_url = profile_url
    if probe_template:
        try:
            probe_url = probe_template.format(username)
        except (IndexError, KeyError, ValueError):
            probe_url = profile_url

    method = str(site_data.get('request_method', 'GET')).upper()
    error_type = str(site_data.get('errorType', 'status_code')).lower()

    try:
        response = requests.request(method, probe_url, timeout=10, headers=headers, allow_redirects=True)
    except requests.RequestException:
        return False, profile_url

    response_text = response.text or ''
    exists = False

    if error_type in ['status_code', 'response_url']:
        exists = response.status_code not in [404, 410]
        if error_type == 'response_url':
            exists = exists and username.lower() in str(response.url).lower()
    elif error_type == 'message':
        error_msg = site_data.get('errorMsg')
        if isinstance(error_msg, list):
            exists = not any(str(message) in response_text for message in error_msg if message)
        elif error_msg:
            exists = str(error_msg) not in response_text
        else:
            exists = response.status_code < 400
    elif error_type == 'regex':
        regex_check = site_data.get('regexCheck')
        if regex_check:
            exists = re.search(str(regex_check), response_text, flags=re.IGNORECASE) is not None
        else:
            exists = response.status_code < 400
    else:
        exists = response.status_code < 400

    if response.status_code in [429, 500, 502, 503, 504]:
        exists = False

    return exists, profile_url


def compact_text(value, max_len=120):
    """Normalize text blocks and keep output compact."""
    if value is None:
        return None
    text = re.sub(r'\s+', ' ', str(value)).strip()
    if not text:
        return None
    if len(text) > max_len:
        text = text[:max_len - 3] + '...'
    return text


def first_non_empty(*values):
    """Return first non-empty cleaned value."""
    for value in values:
        cleaned = compact_text(value)
        if cleaned:
            return cleaned
    return None


def parse_age_from_text(text):
    """Extract age if explicitly written in a profile text."""
    if not text:
        return None

    patterns = [
        r'\b(?:age|aged)\s*[:\-]?\s*(\d{1,2})\b',
        r'\b(\d{1,2})\s*(?:years old|yrs old|yo)\b',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            try:
                age = int(match.group(1))
            except (TypeError, ValueError):
                continue
            if 10 <= age <= 100:
                return str(age)
    return None


def infer_gender_from_text(text):
    """Infer gender only when explicit pronouns/keywords are present."""
    if not text:
        return None
    lowered = text.lower()

    if any(token in lowered for token in ['she/her', 'she / her', 'female', 'woman', 'girl']):
        return 'Female (public hint)'
    if any(token in lowered for token in ['he/him', 'he / him', 'male', 'man', 'boy']):
        return 'Male (public hint)'
    if any(token in lowered for token in ['they/them', 'they / them', 'non-binary', 'nonbinary']):
        return 'Non-binary (public hint)'

    return None


def walk_json_nodes(payload):
    """Yield every JSON object recursively from JSON-LD payloads."""
    if isinstance(payload, dict):
        yield payload
        for value in payload.values():
            yield from walk_json_nodes(value)
    elif isinstance(payload, list):
        for item in payload:
            yield from walk_json_nodes(item)


def extract_public_profile_identity(profile_url, headers):
    """Extract public identity hints from a single profile page."""
    try:
        response = requests.get(profile_url, timeout=PHOMBER_PROFILE_FETCH_TIMEOUT, headers=headers, allow_redirects=True)
        if response.status_code >= 400:
            return {}
        soup = bs4.BeautifulSoup(response.text, 'html.parser')
    except (requests.RequestException, ValueError, TypeError):
        return {}

    identity = {
        'name': None,
        'age': None,
        'gender': None,
        'location': None,
        'bio': None,
        'email': None,
        'occupation': None,
        'website': None,
    }

    og_title = soup.find('meta', attrs={'property': 'og:title'})
    twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
    html_title = soup.find('title')
    og_description = soup.find('meta', attrs={'property': 'og:description'})
    plain_description = soup.find('meta', attrs={'name': 'description'})
    twitter_description = soup.find('meta', attrs={'name': 'twitter:description'})
    canonical_link = soup.find('link', attrs={'rel': 'canonical'})

    title_text = first_non_empty(
        og_title.get('content') if og_title else None,
        twitter_title.get('content') if twitter_title else None,
        html_title.text if html_title else None,
    )
    description_text = first_non_empty(
        og_description.get('content') if og_description else None,
        plain_description.get('content') if plain_description else None,
        twitter_description.get('content') if twitter_description else None,
    )

    if description_text:
        identity['bio'] = description_text
    if canonical_link and canonical_link.get('href'):
        identity['website'] = compact_text(canonical_link.get('href'))

    json_ld_scripts = soup.find_all('script', attrs={'type': re.compile(r'ld\+json', flags=re.IGNORECASE)})
    for script_tag in json_ld_scripts:
        raw_text = script_tag.string or script_tag.get_text(strip=True)
        if not raw_text:
            continue
        try:
            payload = json.loads(raw_text)
        except (ValueError, TypeError, json.JSONDecodeError):
            continue

        for node in walk_json_nodes(payload):
            if not isinstance(node, dict):
                continue

            node_type = node.get('@type', '')
            if isinstance(node_type, list):
                node_type = ' '.join(str(item) for item in node_type)
            node_type = str(node_type)

            if 'Person' in node_type or 'ProfilePage' in node_type:
                identity['name'] = identity['name'] or compact_text(node.get('name'))
                identity['gender'] = identity['gender'] or compact_text(node.get('gender'))
                identity['bio'] = identity['bio'] or compact_text(node.get('description'))
                identity['email'] = identity['email'] or compact_text(node.get('email'))
                identity['website'] = identity['website'] or compact_text(node.get('url'))

                occupation = compact_text(node.get('jobTitle'))
                works_for = node.get('worksFor')
                works_for_name = None
                if isinstance(works_for, dict):
                    works_for_name = compact_text(works_for.get('name'))
                elif isinstance(works_for, str):
                    works_for_name = compact_text(works_for)
                identity['occupation'] = identity['occupation'] or first_non_empty(occupation, works_for_name)

                address = node.get('address')
                if isinstance(address, dict):
                    locality = compact_text(address.get('addressLocality'))
                    region = compact_text(address.get('addressRegion'))
                    country = compact_text(address.get('addressCountry'))
                    identity['location'] = identity['location'] or first_non_empty(
                        ', '.join(filter(None, [locality, region, country]))
                    )
                elif isinstance(address, str):
                    identity['location'] = identity['location'] or compact_text(address)

                birth_date = compact_text(node.get('birthDate'))
                if birth_date and not identity['age']:
                    year_match = re.search(r'(19|20)\d{2}', birth_date)
                    if year_match:
                        birth_year = int(year_match.group(0))
                        age = time.localtime().tm_year - birth_year
                        if 10 <= age <= 100:
                            identity['age'] = str(age)

    body_text = compact_text(soup.get_text(' ', strip=True), max_len=6000)
    profile_text = first_non_empty(description_text, title_text, body_text) or ''

    if not identity['name']:
        # Try to recover display names from titles like "Full Name (@handle)".
        if title_text:
            identity['name'] = compact_text(re.split(r'\||-|•|\(', title_text)[0], max_len=80)

    if not identity['age']:
        identity['age'] = parse_age_from_text(profile_text)
    if not identity['gender']:
        identity['gender'] = infer_gender_from_text(profile_text)
    if not identity['occupation']:
        occupation_hint = re.search(
            r'\b(founder|developer|engineer|designer|student|artist|researcher|manager|consultant|writer|creator)\b',
            profile_text,
            flags=re.IGNORECASE,
        )
        if occupation_hint:
            identity['occupation'] = compact_text(occupation_hint.group(1).title(), max_len=80)

    location_tokens = re.search(
        r'\b(?:based in|from|location|located in)\s*[:\-]?\s*([A-Za-z0-9 .,_-]{3,60})',
        profile_text,
        flags=re.IGNORECASE,
    )
    if location_tokens and not identity['location']:
        identity['location'] = compact_text(location_tokens.group(1), max_len=80)

    if not identity['email']:
        mailto_link = soup.find('a', href=re.compile(r'^mailto:', flags=re.IGNORECASE))
        if mailto_link and mailto_link.get('href'):
            identity['email'] = compact_text(mailto_link.get('href').replace('mailto:', '').strip(), max_len=120)

    return {key: compact_text(value, max_len=120) for key, value in identity.items() if compact_text(value, max_len=120)}


def enrich_username_identity(username, found_profiles, headers):
    """Aggregate best-effort public identity details from matched + deep profile sources."""
    default_identity = {
        'handle': username,
        'name': None,
        'age': None,
        'gender': None,
        'location': None,
        'bio': None,
        'email': None,
        'occupation': None,
        'website': None,
    }

    site_priority = {
        'LinkedIn': 1,
        'GitHub': 2,
        'X/Twitter': 3,
        'Instagram': 4,
        'Facebook': 5,
        'Reddit': 6,
    }

    deep_profile_sources = {
        'LinkedIn': f'https://www.linkedin.com/in/{username}',
        'GitHub': f'https://github.com/{username}',
        'X/Twitter': f'https://x.com/{username}',
        'Instagram': f'https://www.instagram.com/{username}',
        'Facebook': f'https://www.facebook.com/{username}',
        'Reddit': f'https://www.reddit.com/user/{username}',
        'TikTok': f'https://www.tiktok.com/@{username}',
        'YouTube': f'https://www.youtube.com/@{username}',
        'Pinterest': f'https://www.pinterest.com/{username}',
        'Twitch': f'https://www.twitch.tv/{username}',
    }

    ranked_profiles = sorted(found_profiles, key=lambda item: site_priority.get(str(item[0]), 99))
    candidate_profiles = list(ranked_profiles)
    for source_name, source_url in deep_profile_sources.items():
        candidate_profiles.append((source_name, source_url))

    unique_profiles = []
    seen_urls = set()
    for site_name, profile_url in candidate_profiles:
        profile_key = str(profile_url).strip().lower()
        if not profile_key or profile_key in seen_urls:
            continue
        seen_urls.add(profile_key)
        unique_profiles.append((str(site_name), str(profile_url)))

    unique_profiles = unique_profiles[:PHOMBER_USERNAME_IDENTITY_SOURCES]

    merged_identity = dict(default_identity)
    enriched_sources = []

    for site_name, profile_url in unique_profiles:
        profile_identity = extract_public_profile_identity(profile_url, headers)
        if not profile_identity:
            continue

        enriched_sources.append(str(site_name))
        for key in ['name', 'age', 'gender', 'location', 'bio', 'email', 'occupation', 'website']:
            if not merged_identity.get(key) and profile_identity.get(key):
                merged_identity[key] = profile_identity.get(key)

    return merged_identity, enriched_sources, len(unique_profiles)


def format_username_identity(identity_data, enriched_sources, attempted_count):
    """Format public identity section for username scan output."""
    handle = identity_data.get('handle') or 'N/A'
    name = identity_data.get('name') or 'Not public'
    age = identity_data.get('age') or 'Not public'
    gender = identity_data.get('gender') or 'Not public'
    location = identity_data.get('location') or 'Not public'
    bio = identity_data.get('bio') or 'Not public'
    email = identity_data.get('email') or 'Not public'
    occupation = identity_data.get('occupation') or 'Not public'
    website = identity_data.get('website') or 'Not public'

    final_output = '\n    \33[1;49;93m[+] Public identity details (best effort):\033[0m\n\n'
    final_output += f'    \33[1;49;92m> Handle: {handle}\033[0m\n'
    final_output += f'    \33[1;49;92m> Name: {name}\033[0m\n'
    final_output += f'    \33[1;49;92m> Age: {age}\033[0m\n'
    final_output += f'    \33[1;49;92m> Gender: {gender}\033[0m\n'
    final_output += f'    \33[1;49;92m> Occupation: {occupation}\033[0m\n'
    final_output += f'    \33[1;49;92m> Location: {location}\033[0m\n'
    final_output += f'    \33[1;49;92m> Bio: {bio}\033[0m\n'
    final_output += f'    \33[1;49;92m> Email: {email}\033[0m\n'
    final_output += f'    \33[1;49;92m> Website: {website}\033[0m\n'
    final_output += f'    \33[1;49;93m[+] Deep profile checks attempted: \33[1;49;96m{attempted_count}\033[0m\n'

    if enriched_sources:
        final_output += f'\n    \33[1;49;93m[+] Enriched from: \33[1;49;96m{", ".join(enriched_sources)}\033[0m\n'
    else:
        final_output += '\n    \33[1;49;93m[+] Enriched from: \33[1;49;96mNo public identity fields found\033[0m\n'

    final_output += '    \33[1;49;93m[!] Age/Gender are shown only if explicitly public and may be unavailable.\033[0m\n'
    return final_output


def hudson_rock_lookup(search_type, target_value):
    """Query Hudson Rock Cavalier API for exposure intelligence."""
    if not PHOMBER_ENABLE_HUDSON_ROCK:
        return False, None, 'disabled'

    endpoint_map = {
        'username': 'search-by-username',
        'phone': 'search-by-username',
        'email': 'search-by-email',
        'domain': 'search-by-domain',
    }
    endpoint_name = endpoint_map.get(search_type)
    if not endpoint_name:
        return False, None, f'unsupported search type: {search_type}'

    base_url = 'https://cavalier.hudsonrock.com/api/json/v2/osint-tools'
    query_key = 'username' if search_type in ['username', 'phone'] else search_type
    query_value = str(target_value).strip()

    headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'}

    try:
        response = requests.get(
            f'{base_url}/{endpoint_name}',
            params={query_key: query_value},
            timeout=PHOMBER_HUDSON_ROCK_TIMEOUT,
            headers=headers,
        )
    except requests.RequestException as request_error:
        return False, None, str(request_error)

    try:
        response_json = response.json()
    except ValueError:
        response_json = {'message': response.text[:300] if response.text else ''}

    if response.status_code == 404:
        if isinstance(response_json, dict):
            response_json.setdefault('message', 'No data found')
        else:
            response_json = {'message': 'No data found'}
        return True, response_json, None

    if response.status_code >= 400:
        message = ''
        if isinstance(response_json, dict):
            message = str(response_json.get('message') or response_json.get('error') or '').strip()
        error_text = f'HTTP {response.status_code}' + (f' - {message}' if message else '')
        return False, None, error_text

    if not isinstance(response_json, dict):
        response_json = {'data': response_json}

    return True, response_json, None


def hudson_rock_record_count(response_json):
    """Estimate exposure record count from common response shapes."""
    if not isinstance(response_json, dict):
        return 0

    for total_key in ['total', 'count', 'records_count', 'results_count']:
        total_value = response_json.get(total_key)
        if isinstance(total_value, int) and total_value >= 0:
            return total_value

    collection_keys = ['stealers', 'employees', 'users', 'records', 'results', 'items', 'data']
    for key_name in collection_keys:
        key_value = response_json.get(key_name)
        if isinstance(key_value, list):
            return len(key_value)

    return 0


def format_hudson_rock_section(scan_name, target_value, response_json):
    """Render Hudson Rock API response in a compact terminal block."""
    message = ''
    if isinstance(response_json, dict):
        message = compact_text(response_json.get('message') or response_json.get('error') or '', max_len=100) or ''

    record_count = hudson_rock_record_count(response_json)
    status_text = 'Potential exposure data found' if record_count > 0 else 'No exposure records reported'

    section_output = f'''
    \33[1;49;93m[+] Hudson Rock intel ({scan_name}):\033[0m
    \33[1;49;97m> Target:\033[0m {target_value}
    \33[1;49;97m> Source:\033[0m Hudson Rock Cavalier API
    \33[1;49;97m> Status:\033[0m {status_text}
    \33[1;49;97m> Estimated records:\033[0m {record_count}
'''
    if message:
        section_output += f'    \33[1;49;97m> API message:\033[0m {message}\n'

    return section_output, record_count > 0


def run_hudson_rock_section(scan_name, target_value):
    """Execute Hudson Rock lookup and return formatted output + success state."""
    success, response_json, error_text = hudson_rock_lookup(scan_name, target_value)
    if not success:
        if error_text == 'disabled':
            return '', None
        failure_output = f'''\n    \33[1;49;93m[+] Hudson Rock intel ({scan_name}):\033[0m\n    \33[1;49;91m> Lookup skipped: {error_text}\033[0m\n'''
        return failure_output, None

    section_output, found_data = format_hudson_rock_section(scan_name, target_value, response_json)
    return section_output, found_data


def username_search_links(username):
    """Build direct profile and cross-engine search links for a username."""
    direct_profiles = {
        'X/Twitter': f'https://x.com/{username}',
        'Instagram': f'https://www.instagram.com/{username}',
        'Facebook': f'https://www.facebook.com/{username}',
        'LinkedIn': f'https://www.linkedin.com/in/{username}',
        'GitHub': f'https://github.com/{username}',
        'Reddit': f'https://www.reddit.com/user/{username}',
        'TikTok': f'https://www.tiktok.com/@{username}',
        'YouTube': f'https://www.youtube.com/@{username}',
        'Pinterest': f'https://www.pinterest.com/{username}',
        'Twitch': f'https://www.twitch.tv/{username}',
    }

    search_engines = {
        'Google': 'https://www.google.com/search?q={query}',
        'Bing': 'https://www.bing.com/search?q={query}',
        'DuckDuckGo': 'https://duckduckgo.com/?q={query}',
        'Yandex': 'https://yandex.com/search/?text={query}',
        'Brave': 'https://search.brave.com/search?q={query}',
    }

    platform_domains = {
        'X/Twitter': 'x.com',
        'Instagram': 'instagram.com',
        'Facebook': 'facebook.com',
        'LinkedIn': 'linkedin.com',
        'GitHub': 'github.com',
        'Reddit': 'reddit.com',
        'TikTok': 'tiktok.com',
        'YouTube': 'youtube.com',
        'Pinterest': 'pinterest.com',
        'Twitch': 'twitch.tv',
    }

    final_output = '\n    \33[1;49;93m[+] Direct profile URLs:\033[0m\n\n'
    for platform_name, profile_url in direct_profiles.items():
        final_output += f'    \33[1;49;92m> {platform_name}: {profile_url}\033[0m\n'

    final_output += '\n    \33[1;49;93m[+] Search engine dorks (all major engines):\033[0m\n\n'
    for platform_name, domain in platform_domains.items():
        final_output += f'    \33[1;49;97m[{platform_name}]\033[0m\n'
        query = quote_plus(f'"{username}" site:{domain}')
        for engine_name, engine_url in search_engines.items():
            final_output += f'    \33[1;49;92m> {engine_name}: {engine_url.format(query=query)}\033[0m\n'

    return final_output

# Reverse username lookup
def username_lookup(username):
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    username = normalize_scan_target(username)
    started_at = time.perf_counter()
    announce_scan_timing('username', started_at)

    def finalize_scan(result):
        return complete_scan_timing('username', started_at, result)

    # Checking internet connection
    printit(f'    [+] Verifying internet connection...', coledt=[1, 49, 93], space_down=True)
    if not check_connection():
        printit('    > Internet connection not available!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    # Information gathering about the username
    printit(f'    [+] Grathering information about \33[1;49;96m{username}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'    \33[1;49;93m[#] Reverse username lookup for \33[1;49;96m{username}\33[1;49;93m:\033[0m'+'\n\n'

    # Validating username
    if not re.match(r'^[A-Za-z0-9._-]{1,40}$', username):
        printit('    > Invalid username!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    # Headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
    }
    
    site_data = load_sherlock_site_data()
    if not site_data:
        printit('    > Username source manifest unavailable, continuing deep profile research with direct platforms...', coledt=[1, 49, 93], space_down=True)
        site_data = {}

    found_profiles = []
    checked = 0

    for site_name, site_info in site_data.items():
        if checked >= PHOMBER_USERNAME_SITE_LIMIT:
            break

        exists, profile_url = sherlock_profile_check(site_info, username, headers)
        checked += 1
        if exists and profile_url:
            found_profiles.append((str(site_name), str(profile_url)))

    printit(f'    [+] Performing deep profile research (up to {PHOMBER_USERNAME_IDENTITY_SOURCES} profiles)...', coledt=[1, 49, 93], space_down=True)
    identity_data, enriched_sources, attempted_count = enrich_username_identity(username, found_profiles, headers)
    hudson_output, _ = run_hudson_rock_section('username', username)

    if found_profiles:
        final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned Username: \33[1;49;96m{pad_string(username, 34)}\033[0m |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|'''

        for site_name, profile_url in found_profiles:
            site_label = pad_string(truncate_for_table(site_name, 19), 19)
            profile_label = pad_string(truncate_for_table(profile_url, 30), 30)
            final_output += f'''\n    | \33[1;49;97m{site_label}\033[0m | {profile_label} |'''

        final_output += f'''\n    └──────────────────────────────────────────────────────┘\n
    \33[1;49;93m[+] Checked sources: \33[1;49;96m{checked}\033[0m
    \33[1;49;93m[+] Matches found: \33[1;49;96m{len(found_profiles)}\033[0m'''
        final_output += format_username_identity(identity_data, enriched_sources, attempted_count)
        final_output += hudson_output
        final_output += username_search_links(username)

        print(final_output)
        prv_op += final_output+'\n'
        return finalize_scan(True)

    final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned Username: \33[1;49;96m{pad_string(username, 34)}\033[0m |
    |------------------------------------------------------|
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;93mNo public profile found in checked sources\033[0m          |
    └──────────────────────────────────────────────────────┘

    \33[1;49;93m[+] Checked sources: \33[1;49;96m{checked}\033[0m
    '''
    final_output += format_username_identity(identity_data, enriched_sources, attempted_count)
    final_output += hudson_output
    final_output += username_search_links(username)
    print(final_output)
    prv_op += final_output+'\n'
    return finalize_scan(False)


def email_lookup(email_address):
    """Reverse email lookup using Hudson Rock exposure intelligence."""
    global prv_op
    prv_op = ''
    email_address = normalize_scan_target(email_address)
    started_at = time.perf_counter()
    announce_scan_timing('email', started_at)

    def finalize_scan(result):
        return complete_scan_timing('email', started_at, result)

    printit(f'    [+] Verifying internet connection...', coledt=[1, 49, 93], space_down=True)
    if not check_connection():
        printit('    > Internet connection not available!', coledt=[1, 49, 91], space_down=True)
        return finalize_scan(False)

    printit(f'    [+] Grathering information about \33[1;49;96m{email_address}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'    \33[1;49;93m[#] Reverse email lookup for \33[1;49;96m{email_address}\33[1;49;93m:\033[0m' + '\n\n'

    if not re.match(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$', email_address):
        printit('    > Invalid email format! (Example: user@example.com)', coledt=[1, 49, 91])
        return finalize_scan(False)

    hudson_output, found_data = run_hudson_rock_section('email', email_address)
    if not hudson_output:
        hudson_output = '\n    \33[1;49;93m[+] Hudson Rock intel (email):\033[0m\n    \33[1;49;93m> No response data available\033[0m\n'

    search_links = f'''
    \33[1;49;93m[+] Search engine lookup:\033[0m

    \33[1;49;92m> https://www.google.com/search?q={quote_plus(email_address)}
    > https://www.bing.com/search?q={quote_plus(email_address)}
    > https://duckduckgo.com/?q={quote_plus(email_address)}
    > https://yandex.com/search/?text={quote_plus(email_address)}
    > https://search.brave.com/search?q={quote_plus(email_address)}
    \033[0m'''

    final_output = hudson_output + search_links
    print(final_output)
    prv_op += final_output + '\n'
    return finalize_scan(True)

# --------------------------- Basic functions ------------------------ #

def printit(text, center='', line_up=False, line_down=False, space_up=False, space_down=False, coledt=[0, 0, 0], normaltxt_start='', normaltxt_end='', hide=False, verbose_mode=False, input_mode=False):
    if not hide or verbose_mode:
        # get terminal width with fallback for non-interactive shells
        try:
            width = os.get_terminal_size().columns
        except (AttributeError, OSError, ValueError):
            width = 80

        # printing text
        if space_up: print()
        if line_up: print('⸺'*width)

        print(normaltxt_start, end='')

        new_width = int((width - len(text))/2)
        print(center*new_width, end='')
        print(f'\33[{coledt[0]};{coledt[1]};{coledt[2]}m', end='')
        # if input_mode: input_var = input(text)
        if input_mode: input_var = session.prompt(ANSI(text), auto_suggest=AutoSuggestFromHistory(), completer = WordCompleter(available_commands))
        else: print(str(text), end='')
        print('\033[0m', end='')
        print(center*new_width)

        print(normaltxt_end, end='')

        if line_down: print('⸺'*width)
        if space_down: print()

        if input_mode: return input_var

def save_output(prv_cmd):
    try:
        filename = prv_cmd+'_ph0mber_'+str(time.strftime("%d-%m-%Y_%H-%M-%S"))+'.txt'
        pwd = os.getcwd()
        path = os.path.join(pwd, filename)

        file_save_info = f'''
    \33[1;49;93m[#] Output File Name: \33[1;49;97m{filename}\033[0m
    \33[1;49;93m[#] Output File Path: \33[1;49;97m{path}\033[0m
        '''
        print(file_save_info)
    
        header = f'''
    \33[1;49;93m[@] Osint framework: \33[1;49;96mPH0MBER
    \33[1;49;93m[@] Github: \33[1;49;96mhttps://github.com/s41r4j/phomber

    \33[1;49;93m[#] Output File Name: \33[1;49;97m{filename}
    \33[1;49;93m[#] Output File Path: \33[1;49;97m{path}
    \33[1;49;93m[#] Date: \33[1;49;97m{str(time.strftime("%d-%m-%Y"))}
    \33[1;49;93m[#] Time: \33[1;49;97m{str(time.strftime("%H:%M:%S"))}

    \33[1;49;93m[#] Command Executed: \33[1;49;96m{full_cmd.strip()}\n'''

        with open(path, 'w') as f:
            f.write(header)
            f.write(prv_op)
    
        printit(f'    [+] Excute following commands to view output:', coledt=[1, 49, 93], space_down=True, space_up=True)
        
        if os.name == 'nt':
            exe_cmd = f'''    \33[1;49;93m> \33[1;49;92mshell more {filename}\033[0m
    \33[1;49;93m> \33[1;49;92mshell type {filename}\033[0m'''
        else:
            exe_cmd = f'''    \33[1;49;93m> \33[1;49;92mshell cat {filename}\033[0m
    \33[1;49;93m> \33[1;49;92mshell less {filename}\033[0m'''
        print(exe_cmd)

        return True
    except Exception as e:
        printit(f'    [!] Output could not be saved! Error: {e}', coledt=[1, 49, 91], space_down=True)
        return False

def dork_query():
    # Dork query from exploit-db
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:90.0) Gecko/20100101 Firefox/90.0'}
        dork_query = requests.get('https://www.exploit-db.com/ghdb/'+str(random.randint(1000, 8000)), headers=headers, timeout=12)
        
        # If exploit-db is available
        if dork_query.status_code == 200:
            # Parsing html
            parsed_html = bs4.BeautifulSoup(dork_query.text, 'html.parser')
            
            # extracting query (h1 -> class: card-title)
            query = parsed_html.find('h1', attrs={'class': 'card-title'}).text.strip()

            return query
    except (requests.RequestException, AttributeError, ValueError, KeyError):
        pass
        
    # If dork query is not available, use local dork query
    local_dork_query = ['site:domain.com filetype: pdf', 'inurl: password', 'intext:”username”', 'filetype:xls',
                        'filetype:txt “username”', 'filetype:log “PHP Parse error” | “PHP Warning” | “PHP Error”',
                        'intitle: “index of”', 'intitle: “index of” “.git”', 'intitle: “index of” “.svn”',
                        'inurl:”viewerframe?mode', 'inurl:”MultiCameraFrame?Mode=Motion”', 'intitle: “index of” “.bash_history”',
                        'intext: “Last modified”', 'intext: “Index of /”', 'intext: “Parent Directory”',
                        'inurl: “admin”', 'inurl: “login”', 'inurl: “login” “admin”', 'inurl: “login” “admin” “user”',
                        'intext:”privacy policy”', '"passwords.txt" intitle:"Index of"', 'intext:”@gmail.com”']
    return random.choice(local_dork_query)

def logo():
    # clear screen (windows/linux/mac)
    os.system('cls' if os.name == 'nt' else 'clear')

    # display logo
    printit('─ ▒█▀▀█ ▒█░▒█ █▀▀█ ▒█▀▄▀█ ▒█▀▀█ ▒█▀▀▀ ▒█▀▀█ ─', center=' ', coledt=[1, 49, random.choice([91, 92, 93, 94, 95, 96, 97])], space_up=True)
    printit('─ ▒█▄▄█ ▒█▀▀█ █▄▀█ ▒█▒█▒█ ▒█▀▀▄ ▒█▀▀▀ ▒█▄▄▀ ─', center=' ', coledt=[1, 49, random.choice([91, 92, 93, 94, 95, 96, 97])])
    printit('─ ▒█░░░ ▒█░▒█ █▄▄█ ▒█░░▒█ ▒█▄▄█ ▒█▄▄▄ ▒█░▒█ ─', center=' ', coledt=[1, 49, random.choice([91, 92, 93, 94, 95, 96, 97])], space_down=True)
    printit('OSINT-FRAMEWORK                   @s41r4j', center=' ', coledt=[1, 49, random.choice([91, 92, 93, 94, 95, 96, 97])])
    printit('                                  @DkHrR', center=' ', coledt=[1, 49, random.choice([91, 92, 93, 94, 95, 96, 97])], space_down=True)

# ------------------------- Main functions -------------------------- #

def control_center():
    # Global variables
    global silent_mode
    
    # Starting control center
    if not silent_mode: printit('[#] Initializing `PH0MBER` framework...', coledt=[1, 49, random.choice([92, 96, 97])], line_down=True, line_up=True, space_up=True)

    # EXPRESSIONS
    # ':D' -> green  | everyting is fine
    # ':)' -> blue   | info (help menu, cmd list, etc)
    # ':|' -> yellow | warning (unstable)
    # ':(' -> red    | something went wrong (error)
    # ':o' -> white  | found something (scan, search, etc)

    exp = ['\33[1;49;92m:D\033[0m',
           '\33[1;49;96m:)\033[0m', 
           '\33[1;49;93m:|\033[0m', 
           '\33[1;49;91m:(\033[0m', 
           '\33[1;49;97m:o\033[0m']

    # current expression
    crt_exp = exp[0]

    exp_info = '''    \33[1;49;93m> Expressions are used to show the status of the previous command\033[0m

    \33[1;49;93m> Syntax:\033[0m \33[1;49;97m[<user>@ph0mber]⸺ \33[1;49;96m[<expression>]\33[1;49;97m $ <command>\033[0m

    ┌────────────────────────────────────────────────────┐
    | EXPRESSIONS   | DESCRIPTION                        |
    |----------------------------------------------------|
    | \33[1;49;92m:D\033[0m            | Everything is fine                 |
    | \33[1;49;96m:)\033[0m            | Information available              |
    | \33[1;49;93m:|\033[0m            | It's a warning (remember)          |
    | \33[1;49;91m:(\033[0m            | Something went wrong               |
    | \33[1;49;97m:o\033[0m            | Scan results available             |
    └────────────────────────────────────────────────────┘'''

    # Variables
    system_snapshot = build_system_snapshot()
    runtime_profile = system_snapshot.get('runtime_profile', {})
    compatibility_warnings = list(system_snapshot.get('warnings', []))
    if PHOMBER_COMPATIBILITY_MODE:
        compatibility_warnings.append('compatibility mode enabled (reduced strictness for restricted runtimes)')

    user = style_info_field(str(getpass.getuser()), 34)
    hostname = style_info_field(str(platform.node()), 34)
    os_name = style_info_field(str(platform.system()), 34)
    runtime_name = style_info_field(str(runtime_profile.get('profile', 'standard')), 34)
    ram = style_info_field(system_snapshot.get('ram_usage', 'N/A'), 33)
    cpu = style_info_field(system_snapshot.get('cpu_usage', 'N/A'), 32)
    disk = style_info_field(system_snapshot.get('disk_usage', 'N/A'), 33)
    sys_mac = style_info_field(str(':'.join(re.findall('..', '%012x' % uuid.getnode()))), 34)

    arch = style_info_field(str(platform.machine()), 34)
    
    ver = style_info_field('3.1.1', 34)

    sysinfo = f'''
    ┌────────────────────────────────────────────────────┐
    | SYSTEM INFO   | DESCRIPTION                        |
    |----------------------------------------------------|
    | \33[1;49;97mUser\033[0m          | {user} |
    | \33[1;49;97mHostname\033[0m      | {hostname} |
    | \33[1;49;97mOS\033[0m            | {os_name} |
    | \33[1;49;97mRuntime\033[0m       | {runtime_name} |
    | \33[1;49;97mArchitecture\033[0m  | {arch} |
    | \33[1;49;97mSystem MAC\033[0m    | {sys_mac} |
    |----------------------------------------------------|
    | \33[1;49;97mRAM Usage\033[0m     | {ram} |
    | \33[1;49;97mCPU Usage\033[0m     | {cpu} |
    | \33[1;49;97mDisk Usage\033[0m    | {disk} |
    └────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────┐
    | FRAMEWORK INFO| DESCRIPTION                        |
    |----------------------------------------------------|
    | \33[1;49;97mName\033[0m          | \33[1;49;96mPH0MBER\033[0m                            |
    | \33[1;49;97mVersion\033[0m       | {ver} |
    | \33[1;49;97mType\033[0m          | \33[1;49;96mOSINT Framework\033[0m                    |
    | \33[1;49;97mDeveloper\033[0m     | \33[1;49;96ms41r4j, DkHrR\033[0m                      |
    | \33[1;49;97mGithub\033[0m        | \33[1;49;96mhttps://github.com/s41r4j/phomber\033[0m  |
    └────────────────────────────────────────────────────┘
    '''

    if not silent_mode and compatibility_warnings:
        printit('    [!] Compatibility notices:', coledt=[1, 49, 93], space_down=True)
        for warning_text in sorted(set(compatibility_warnings)):
            printit(f'    > {warning_text}', coledt=[1, 49, 93])

    help = '''
    ┌────────────────────────────────────────────────────┐
    | COMMANDS      | DESCRIPTION                        |
    |----------------------------------------------------|
    |                 <(Basic Commands)>                 |
    |----------------------------------------------------|
    | \33[1;49;97mhelp\033[0m          | Display this help menu             | 
    | \33[1;49;97mexit/quit\033[0m     | Exit the framework                 |
    | \33[1;49;97mdork\033[0m          | Show a random google dork query \33[1;49;91m*\033[0m  |  
    | \33[1;49;97mexp\033[0m           | Show info about all available      |       
    |               | expressions                        |
    | \33[1;49;97mcheck\033[0m         | Check internet connection          |
    | \33[1;49;97mclear\033[0m         | Clear screen                       |
    | \33[1;49;97mflush\033[0m         | Flush history                      |
    | \33[1;49;97msave\033[0m          | Save output of previous scanner    |
    |               | command in a file                  |
    | \33[1;49;97mshell <cmd>\033[0m   | Execute native shell/cmd commands  |
    | \33[1;49;97minfo\033[0m          | Show info about framework & system |
    | \33[1;49;97mchange\033[0m        | Change user command input color    |
    |----------------------------------------------------|
    |                <(Scanner Commands)>                |
    |----------------------------------------------------|
    | \33[1;49;97mnumber\033[0m        | Reverse phone number lookup        |
    | \33[1;49;97memail\033[0m         | Reverse email lookup \33[1;49;91m*\033[0m             |
    | \33[1;49;97mip\033[0m            | Reverse ip address lookup \33[1;49;91m*\033[0m        |
    | \33[1;49;97mmac\033[0m           | Reverse mac address lookup         |
    | \33[1;49;97mwhois\033[0m         | Reverse whois lookup \33[1;49;91m*\033[0m             |
    | \33[1;49;97mdns\033[0m           | Reverse / Normal DNS lookup \33[1;49;91m*\033[0m     |
    | \33[1;49;97musername\033[0m      | Username lookup over multiple sites|
    |               | and social media platforms \33[1;49;91m*\033[0m       |
    └────────────────────────────────────────────────────┘
    '''

    tips = ['Type `\33[7;49;93mhelp <command>\033[0m\33[1;49;93m` to see more info about a command',
            'Use `\33[7;49;93mTab\033[0m\33[1;49;93m` key to auto-complete commands',
            'Try silent mode by using `\33[7;49;93m-s\033[0m\33[1;49;93m`/`\33[7;49;93m--silent\033[0m\33[1;49;93m` flag',
            'You can also use `\33[7;49;93mCtrl+C\033[0m\33[1;49;93m` to exit',
            'Descriptions ending with `\33[7;49;93m*\033[0m\33[1;49;93m` needs internet connection',
            ]

    # Previous command
    prv_cmd = ''
    global prv_op 
    global full_cmd

    # Setting up auto-complete
    completer = WordCompleter(available_commands)

    # Command prompt color
    cmd_color = ['\33[1;49;90m', '\33[1;49;97m']
    crt_color = cmd_color[1]

    # Control center loop
    while True:
        # [user@phomber]⸺[:D] $
        cmd = (printit(f'\n\033[0m[{user.strip()}@ph0mber]⸺ [{crt_exp}] $ {crt_color}', input_mode=True, space_up=True)).strip()

        if cmd == 'help':
            crt_exp = exp[1]
            prv_op = ''
            print(help)
            tip = random.choice(tips)
            print(f'\33[1;49;93m    > {tip}\033[0m')
        elif cmd[:4] == 'help':
            if (cmd+'#')[4] == ' ':
                cmd = cmd[5:]
                if cmd == 'help':
                    crt_exp = exp[1]
                    help_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mhelp\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `help`, the help menu will be displayed
    \33[1;49;92m> SYNTAX: \33[1;49;97mhelp \33[1;49;92mOR \33[1;49;97mhelp <command>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mhelp \33[1;49;92mOR \33[1;49;97mhelp number
    \033[0m'''
                    print(help_help)
                elif cmd == 'exit' or cmd == 'quit':
                    crt_exp = exp[1]
                    exit_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mexit/\33[1;49;93mquit\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `exit` or `quit`, the program will be terminated
    \33[1;49;92m> SYNTAX: \33[1;49;97mexit \33[1;49;92mOR \33[1;49;97mquit
    \033[0m'''
                    print(exit_help)
                elif cmd == 'dork':
                    crt_exp = exp[1]
                    dork_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mdork\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `dork`, a random google dork query will be displayed
    \33[1;49;92m> SYNTAX: \33[1;49;97mdork
    \033[0m'''
                    print(dork_help)
                elif cmd == 'exp':
                    crt_exp = exp[1]
                    exp_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mexp\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `exp`, info about all available expressions will be displayed
    \33[1;49;92m> SYNTAX: \33[1;49;97mexp
    \033[0m'''
                    print(exp_help)
                elif cmd == 'check':
                    crt_exp = exp[1]
                    check_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mcheck\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `check`, it will check for internet connection availability
    \33[1;49;92m> SYNTAX: \33[1;49;97mcheck
    \033[0m'''
                    print(check_help)
                elif cmd == 'flush':
                    crt_exp = exp[1]
                    flush_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mflush\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `flush`, it will flush the history
    \33[1;49;92m> SYNTAX: \33[1;49;97mflush
    \033[0m'''
                    print(flush_help)
                elif cmd == 'clear':
                    crt_exp = exp[1]
                    clear_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mclear\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `clear`, it will clear the screen
    \33[1;49;92m> SYNTAX: \33[1;49;97mclear
    \033[0m'''
                    print(clear_help)
                elif cmd == 'save':
                    crt_exp = exp[1]
                    save_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93msave\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `save`, it will save the output of previous command
    \33[1;49;92m> SYNTAX: \33[1;49;97msave
    \33[1;49;92m> EXAMPLE: \33[1;49;97msave
    \033[0m'''
                    print(save_help)
                elif cmd[:5] == 'shell':
                    crt_exp = exp[1]
                    shell_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mshell\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `shell`, it will execute given command in native shell/cmd
    \33[1;49;92m> SYNTAX: \33[1;49;97mshell <cmd>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mshell ls
    \033[0m'''
                    print(shell_help)
                elif cmd == 'info':
                    crt_exp = exp[1]
                    info_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93minfo\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `info`, it will show info about framework & system
    \33[1;49;92m> SYNTAX: \33[1;49;97minfo
    \033[0m'''
                    print(info_help)
                elif cmd == 'change':
                    crt_exp = exp[1]
                    change_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mchange\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `change`, it will change user command input color
    \33[1;49;92m> OPTIONS: \33[1;49;97m0 -> \33[1;49;90mBlack
               \33[1;49;97m1 -> White        
    \33[1;49;92m> Default: \33[1;49;97m1
    \33[1;49;92m> SYNTAX: \33[1;49;97mchange <color_code>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mchange 0
    \033[0m'''
                    print(change_help)
                elif cmd == 'number':
                    crt_exp = exp[1]
                    number_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mnumber\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `number`, it will reverse lookup phone number over internet and show public info associated with it
    \33[1;49;92m> SYNTAX: \33[1;49;97mnumber <phone_number>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mnumber +1234567890
    \033[0m'''
                    print(number_help)
                elif cmd == 'email':
                    crt_exp = exp[1]
                    email_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93memail\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `email`, it performs email exposure lookup using Hudson Rock and search-engine pivots
    \33[1;49;92m> SYNTAX: \33[1;49;97memail <email_address>
    \33[1;49;92m> EXAMPLE: \33[1;49;97memail user@example.com
    \033[0m'''
                    print(email_help)
                elif cmd == 'whois':
                    crt_exp = exp[1]
                    whois_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mwhois\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `whois`, it will perform reverse whois lookup
    \33[1;49;92m> SYNTAX: \33[1;49;97mwhois <domain_name>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mwhois example.com
    \033[0m'''
                    print(whois_help)
                elif cmd == 'dns':
                    crt_exp = exp[1]
                    dns_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mdns\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `dns`, it will perform dns lookup for given domain name or reverse dns lookup for given ip address
    \33[1;49;92m> SYNTAX: \33[1;49;97mdns <ip_address> \33[1;49;92mOR \33[1;49;97m<domain_name>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mdns 192.168.1.1 \33[1;49;92mOR \33[1;49;97mdns example.com
    \033[0m'''
                    print(dns_help)
                elif cmd == 'ip':
                    crt_exp = exp[1]
                    ip_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mip\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `ip`, it will perform an ip address lookup over internet and show info about given ip address
    \33[1;49;92m> SYNTAX: \33[1;49;97mip <ip_address>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mip 8.8.8.8
    \033[0m'''
                    print(ip_help)
                elif cmd == 'username':
                    crt_exp = exp[1]
                    username_help = f'''  \33[1;49;93m[+] Command Info: \33[1;49;93musername\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `username`, it will perform reverse username lookup over various social media platforms and check if username is associated with any account
    \33[1;49;92m> SYNTAX: \33[1;49;97musername <username>
    \33[1;49;92m> EXAMPLE: \33[1;49;97musername {user.strip()}
    \033[0m'''
                    print(username_help)
                elif cmd == 'mac':
                    crt_exp = exp[1]
                    mac_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mmac\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `mac`, it will lookup probable vendor/manufacture of given mac address
    \33[1;49;92m> SYNTAX: \33[1;49;97mmac <mac_address>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mmac ff:ff:ff:ff:ff:ff
    \033[0m'''
                    print(mac_help)
                else:
                    crt_exp = exp[3]
                    printit('    [!] Invalid sub-command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            prv_op = ''

        # Basic commands
        elif cmd == 'exit' or cmd == 'quit':
            if not silent_mode: printit('    [@] Thank you for using `PH0MBER` osint framework :)', coledt=[1, 49, random.choice([92, 96, 97])])
            # printit('    [@] Support this project: https://www.buymeacoffee.com/s41r4j', coledt=[1, 49, random.choice([92, 97])])
            raise KeyboardInterrupt
        elif cmd == 'dork':
            crt_exp = exp[1]
            prv_op = ''
            printit('    [+] Generating random dork query...', coledt=[1, 49, 93], space_down=True)
            printit('    > '+dork_query(), coledt=[1, 49, 92])
        elif cmd == 'exp':
            crt_exp = exp[1]
            prv_op = ''
            print(exp_info)
        elif cmd == 'check':
            printit('    [+] Checking internet connection...', coledt=[1, 49, 93], space_down=True)
            try:
                requests.get('https://www.google.com/', timeout=10)
                printit('    > Internet connection is available!', coledt=[1, 49, 92])
                try:
                    public_ip = requests.get('https://httpbin.org/ip', timeout=10).json()['origin']
                except:
                    try:
                        public_ip = requests.get('https://ident.me', timeout=10).text
                    except:
                        try:
                            public_ip = requests.get('https://api.ipify.org', timeout=10).text
                        except:
                            public_ip = False
                if public_ip:
                    printit(f'    > Public IP address: {public_ip}', coledt=[1, 49, 92])
                crt_exp = exp[0]
            except:
                printit('    > Internet connection is not available!', coledt=[1, 49, 91])
                printit('    > Local IP address: 127.0.0.1', coledt=[1, 49, 92])
                crt_exp = exp[3]
            prv_op = ''
        elif cmd == 'clear':
            crt_exp = exp[0]
            prv_op = ''
            os.system('cls' if os.name == 'nt' else 'clear')
        elif cmd == 'flush':
            crt_exp = exp[0]
            prv_op = ''
            if os.path.exists('./.ph0mber_history'): # delete history file
                os.remove('./.ph0mber_history')
                global session
                try: session = PromptSession(history=FileHistory('./.ph0mber_history'))
                except: session = PromptSession(history=InMemoryHistory())
            printit('    > History flushed successfully!', coledt=[1, 49, 92])
        elif cmd == 'save':
            printit('    [+] Saving output of previous command...', coledt=[1, 49, 93], space_down=True)
            if prv_op == '':
                printit('    > No output found! Saves output of previous scanner command only!', coledt=[1, 49, 91])
                crt_exp = exp[2]
            else:
                if save_output(prv_cmd):
                    crt_exp = exp[0]
                else:
                    crt_exp = exp[3]
            prv_op = ''
        elif cmd == 'shell':
            crt_exp = exp[2]   
            prv_op = '' 
            printit('    > No command found! Type `help shell` to see more info.', coledt=[1, 49, 91])
        elif cmd[:5] == 'shell':
            if (cmd+'#')[5] == ' ':
                cmd = cmd[6:]
                exec_cmd = f'''    \33[7;49;93m[+] Executing command: {str(cmd)}\033[0m\n'''           
                print(exec_cmd)
            
                output = os.system(cmd)
                if output == 0:
                    printit('> Command executed successfully!', coledt=[7, 49, 92], normaltxt_start='\n    ')
                    crt_exp = exp[0]
                else:
                    printit('> Command execution failed!', coledt=[7, 49, 91], normaltxt_start='\n    ')
                    crt_exp = exp[3]
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            prv_op = ''
        elif cmd == 'info':
            crt_exp = exp[1]
            prv_op = ''
            print(sysinfo)
        elif cmd == 'change':
            crt_exp = exp[2]   
            prv_op = '' 
            printit('    > No color code found! Type `help change` to see more info.', coledt=[1, 49, 91])
        elif cmd[:6] == 'change':
            if (cmd+'#')[6] == ' ':
                cmd = cmd[7:]
                if cmd == '0':
                    crt_color = cmd_color[0]
                    crt_exp = exp[0]
                    printit('    > Color changed successfully to BLACK!', coledt=[1, 49, 92])
                elif cmd == '1':
                    crt_color = cmd_color[1]
                    crt_exp = exp[0]
                    printit('    > Color changed successfully to WHITE!', coledt=[1, 49, 92])
                else:
                    crt_exp = exp[3]
                    printit('    [!] Invalid color code! Type `help change` to see more info.', coledt=[1, 49, 91])
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            prv_op = ''

        # Scanner commands
        elif cmd == 'number':
            crt_exp = exp[2]
            printit('    > No phone number found! Type `help number` to see more info', coledt=[1, 49, 91])
        elif cmd[:6] == 'number':
            full_cmd = cmd
            if (cmd+'#')[6]  == ' ':
                cmd = cmd[7:]
                printit('    [+] Performing reverse phone number lookup...', coledt=[1, 49, 93], space_down=True)
                if number_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'email':
            crt_exp = exp[2]
            printit('    > No email found! Type `help email` to see more info', coledt=[1, 49, 91])
        elif cmd[:5] == 'email':
            full_cmd = cmd
            if (cmd+'#')[5] == ' ':
                cmd = cmd[6:]
                printit('    [+] Performing reverse email lookup...', coledt=[1, 49, 93], space_down=True)
                if email_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'ip':
            crt_exp = exp[2]
            printit('    > No ip address found! Type `help ip` to see more info', coledt=[1, 49, 91])
        elif cmd[:2] == 'ip':
            full_cmd = cmd
            if (cmd+'#')[2]  == ' ':
                cmd = cmd[3:]
                printit('    [+] Performing reverse ip address lookup...', coledt=[1, 49, 93], space_down=True)
                if ip_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'mac':
            crt_exp = exp[2]
            printit('    > No mac address found! Type `help mac` to see more info', coledt=[1, 49, 91])
        elif cmd[:3] == 'mac':
            full_cmd = cmd
            if (cmd+'#')[3]  == ' ':
                cmd = cmd[4:]
                printit('    [+] Performing reverse mac address lookup...', coledt=[1, 49, 93], space_down=True)
                if mac_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'whois':
            crt_exp = exp[2]
            printit('    > No domain found! Type `help whois` to see more info', coledt=[1, 49, 91])
        elif cmd[:5] == 'whois':
            full_cmd = cmd
            if (cmd+'#')[5]  == ' ':
                cmd = cmd[6:]
                printit('    [+] Performing reverse domain lookup...', coledt=[1, 49, 93], space_down=True)
                if whois_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'dns':
            crt_exp = exp[2]
            printit('    > No domain found! Type `help dns` to see more info', coledt=[1, 49, 91])
        elif cmd[:3] == 'dns':
            full_cmd = cmd
            if (cmd+'#')[3]  == ' ':
                cmd = cmd[4:]
                printit('    [+] Performing dns lookup...', coledt=[1, 49, 93], space_down=True)
                if dns_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'username':
            crt_exp = exp[2]
            printit('    > No username found! Type `help username` to see more info', coledt=[1, 49, 91])
        elif cmd[:8] == 'username':
            full_cmd = cmd
            if (cmd+'#')[8]  == ' ':
                cmd = cmd[9:]
                printit('    [+] Performing reverse username lookup...', coledt=[1, 49, 93], space_down=True)
                if username_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
                    prv_op = ''
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            

        # If command is not available
        else:
            crt_exp = exp[3]
            printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])

        # Updating previous command
        prv_cmd = cmd    

def main():
    # Global variables
    global silent_mode

    # Checking for silent mode
    try:
        if '-s' in sys.argv or '--silent' in sys.argv:
            silent_mode = True
    except IndexError:
        pass

    # Displaying logo
    if not silent_mode: logo()

    # Starting control center
    try:
        control_center()
    except KeyboardInterrupt:
        print()
        if not silent_mode:
            printit('[#] Terminating `PH0MBER` framework...', coledt=[1, 49, random.choice([91, 93])], space_down=True, line_down=True, line_up=True, space_up=True)
            exit()
        else: print()
    except Exception as e:
        print()
        if not silent_mode:
            printit(f'[!] An error occured: {e}', coledt=[1, 49, 91], space_up=True)
            print_startup_diagnostics(e)
            # Checking for verbose errors
            try:
                if '-e' in sys.argv or '--verbose-errors' in sys.argv:
                    printit(f'[+] Detailed error: {sys.exc_info()}', coledt=[1, 49, 91], space_down=True)
                else:
                    raise IndexError
            except IndexError:
                printit(f'[i] Use `-e`/`--verbose-errors` flag to see detailed error', coledt=[1, 49, 93], space_up=True)
            printit(f'[i] Please report this error/bug/issue at: https://github.com/s41r4j/phomber/issues', coledt=[1, 49, 93], space_down=True)
            printit('[#] Terminating `PH0MBER` framework...', coledt=[1, 49, random.choice([91, 93])], space_down=True, line_down=True, line_up=True, space_up=True)
            exit()
        else: print()

if __name__ == '__main__':
    main()