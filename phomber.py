#!/usr/bin/python3

#==============================================================================#
#                                                                              #
# [prog]   : Ph0mber                                                           #
# [ver]    : 3.0 beta                                                          #
# [desc]   : Multi-porpose osint framework for gathering information           #
# [dev]    : @s41r4j                                                           #
# [github] : https://github.com/s41r4j/phomber                                 #
# [license]: GNU GPLv3                                                         #
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
import readline      # Default
import re            # Default
import psutil        # pip install psutil
import bs4           # pip install beautifulsoup4
import phonenumbers  # pip install phonenumbers


# ------------------------ Global variables ------------------------ #
avaliable_commands = ['help', 'exit', 'quit', 'dork', 'exp', 'check', 'clear', 'save', 'shell', 'info', 'change', 'number', 'ip']
prv_op = ''
silent_mode = False


# ------------------------ Scanner functions ------------------------ #
# Check internet connection
def check_connection(url):
    # Checking internet connection
    try:
        requests.get(url, timeout=10)
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

    # Information gathering about the number
    printit(f'    [+] Grathering information about \33[1;49;96m{phone_number}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'\n    \33[1;49;93m[#] Reverse phone number lookup for \33[1;49;96m{phone_number}\33[1;49;93m:\033[0m'+'\n'

    # Check if the number is valid or not (regex)
    if not re.match(r'^\+[1-9]\d{1,14}$', phone_number):
        printit('    > Invalid phone number format! (Example: +44xxxxxxxxxx)', coledt=[1, 49, 91])
        prv_op += '    > Invalid phone number format! (Example: +44xxxxxxxxxx)'+'\n'
        return False
    
    # Country code check
    try:
        # Phone number format: (+Countrycode)xxxxxxxxxx
        phone_number_details = phonenumbers.parse(phone_number)
    except phonenumbers.phonenumberutil.NumberParseException:
        printit('    > Missing Country Code! (Example: +91, +44, +1)', coledt=[1, 49, 91])
        prv_op += '    > Missing Country Code! (Example: +91, +44, +1)'+'\n'
        return False

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
    \33[1;49;93m[+] Google Dork Queries:

    \33[1;49;92m> https://www.google.com/search?q={only_number.strip()}
    \033[0m'''
        print(google_dork_queries)
        prv_op += google_dork_queries+'\n'

        return True
        
    else:
        # Reconfiguring variables
        possible = str(possible)+' '*int(30-len(str(possible)))
        valid = str(valid)+' '*int(30-len(str(valid)))

        final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | INFORMATION         | DESCRIPTION                    |
    |------------------------------------------------------|
    | \33[1;49;97mPossible\033[0m            | {possible} |
    | \33[1;49;97mValid\033[0m               | {valid} |
    └──────────────────────────────────────────────────────┘
        '''
        print(final_output)
        prv_op += final_output+'\n'
        return False

# Reverse ip address lookup
def ip_lookup(ip_address):
    # Global variables
    global prv_op
    prv_op = '' # Resetting previous output
    
    # Checking internet connection
    printit(f'    [+] Verifying internet connection...', coledt=[1, 49, 93], space_down=True)
    if not check_connection('https://www.google.com'):
        printit('    > Internet connection not available!', coledt=[1, 49, 91], space_down=True)
        prv_op += '\n    \33[1;49;91m> Internet connection not available!\033[0m'+'\n'
        return False

    # Information gathering about the ip address
    printit(f'    [+] Grathering information about \33[1;49;96m{ip_address}\33[1;49;93m...', coledt=[1, 49, 93], space_down=True)
    prv_op += f'    \33[1;49;93m[#] Reverse ip address lookup for \33[1;49;96m{ip_address}\33[1;49;93m:\033[0m'+'\n'

    # Check if the ip address is valid or not (regex) [add IPv6 support]
    if not re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', ip_address) :
        printit('    > Invalid ip address format! (Example: 8.8.8.8)', coledt=[1, 49, 91])
        prv_op += '   \33[1;49;91m> Invalid ip address format! (Example: 8.8.8.8)\033[0m'+'\n'
        return 

    # IP address lookup APIs
    ip_addresses = [f'http://ip-api.com/json/{ip_address}', f'https://ipapi.co/{ip_address}/json/', f'http://ipwho.is/{ip_address}']
    ip_address = str(ip_address)+' '*int(30-len(str(ip_address)))

    # Headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
    }
    
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
    | Server code name  : \33[1;49;96mreverse-ip-lookup-server-1\033[0m       |
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
    | Server code name  : \33[1;49;96mreverse-ip-lookup-server-1\033[0m       |
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
    | Server code name  : \33[1;49;96mreverse-ip-lookup-server-2\033[0m       |
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

        except:
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    | Server code name  : \33[1;49;96mreverse-ip-lookup-server-2\033[0m       |
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
    | Server code name  : \33[1;49;96mreverse-ip-lookup-server-3\033[0m       |
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

        except:
            final_output = f'''
    ┌──────────────────────────────────────────────────────┐
    | Scanned IP Address: \33[1;49;96m{ip_address}\033[0m   |
    | Server code name  : \33[1;49;96mreverse-ip-lookup-server-3\033[0m       |
    |------------------------------------------------------|
    | \33[1;49;91mFailed to Fetch information from this server!\033[0m        |
    └──────────────────────────────────────────────────────┘
    '''
            print(final_output)
            prv_op += final_output+'\n'

    return True


# --------------------------- Basic functions ------------------------ #

def printit(text, center='', line_up=False, line_down=False, space_up=False, space_down=False, coledt=[0, 0, 0], normaltxt_start='', normaltxt_end='', hide=False, verbose_mode=False, input_mode=False):
    if not hide or verbose_mode:
        # get terminal width
        width = os.get_terminal_size().columns

        # printing text
        if space_up: print()
        if line_up: print('⸺'*width)

        print(normaltxt_start, end='')

        if len(text) < width:
            new_width = int((width - len(text))/2)
            print(center*new_width, end='')
            print(f'\33[{coledt[0]};{coledt[1]};{coledt[2]}m', end='')
            if input_mode: input_var = input(text)
            else: print(str(text), end='')
            print('\033[0m', end='')
            print(center*new_width)

        print(normaltxt_end, end='')

        if line_down: print('⸺'*width)
        if space_down: print()

        if input_mode: return input_var

def save_output(prv_cmd):
    try:
        filename = prv_cmd+'_'+str(time.strftime("%d-%m-%Y_%H-%M-%S"))+'.txt'
        pwd = os.getcwd()
        os_name = os.uname()
        path = pwd+'/'+filename

        file_save_info = f'''
    \33[1;49;93m[#] Output File Name: \33[1;49;97m{filename}\033[0m
    \33[1;49;93m[#] Output File Path: \33[1;49;97m{path}\033[0m
        '''
        print(file_save_info)

        with open(path, 'w') as f:
            f.write(prv_op)
    
        printit(f'    [+] Excute following commands to view output:', coledt=[1, 49, 93], space_down=True, space_up=True)
        
        if os_name == 'nt':
            exe_cmd = f'''    \33[1;49;92m> shell more {path}\033[0m
    \33[1;49;92m> shell type {path}\033[0m'''
        else:
            exe_cmd = f'''    \33[1;49;92m> shell cat {path}\033[0m
    \33[1;49;92m> shell less {path}\033[0m'''
        print(exe_cmd)

        return True
    except:
        printit(f'    [!] Output could not be saved!', coledt=[1, 49, 91], space_down=True)
        return False

def dork_query():
    # Dork query from exploit-db
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:90.0) Gecko/20100101 Firefox/90.0'}
        dork_query = requests.get('https://www.exploit-db.com/ghdb/'+str(random.randint(1000, 8000)), headers=headers)
        
        # If exploit-db is available
        if dork_query.status_code == 200:
            # Parsing html
            parsed_html = bs4.BeautifulSoup(dork_query.text, 'html.parser')
            
            # extracting query (h1 -> class: card-title)
            query = parsed_html.find('h1', attrs={'class': 'card-title'}).text.strip()

            return query
    except:
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
    printit('OSINT-FRAMEWORK                   @s41r4j', center=' ', coledt=[1, 49, random.choice([91, 92, 93, 94, 95, 96, 97])], space_down=True)

def completer(text, state):
    commands = avaliable_commands
    options = [i for i in commands if i.startswith(text)]
    if state < len(options):
        return options[state]
    else:
        return None

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
    user = '\33[1;49;96m'+str(os.getlogin())+'\033[0m'+ ' '*int(34-len(str(os.getlogin())))
    hostname = '\33[1;49;96m'+str(os.uname().nodename)+'\033[0m'+' '*int(34-len(str(os.uname().nodename)))
    os_name = '\33[1;49;96m'+str(os.uname().sysname)+'\033[0m'+' '*int(34-len(str(os.uname().sysname)))
    ram = '\33[1;49;96m'+str(psutil.virtual_memory().percent)+"%"+'\033[0m'+' '*int(33-len(str(psutil.virtual_memory().percent)))
    cpu = '\33[1;49;96m'+str(psutil.cpu_percent())+"%"+'\033[0m'+' '*int(32-len(str(psutil.cpu_percent())))
    disk = '\33[1;49;96m'+str(psutil.disk_usage('/').percent)+"%"+'\033[0m'+' '*int(33-len(str(psutil.disk_usage('/').percent)))

    ver = '\33[1;49;96m3.0 beta\033[0m'+' '*int(34-len(str(3.0)))

    sysinfo = f'''
    ┌────────────────────────────────────────────────────┐
    | SYSTEM INFO   | DESCRIPTION                        |
    |----------------------------------------------------|
    | \33[1;49;97mUser\033[0m          | {user} |
    | \33[1;49;97mHostname\033[0m      | {hostname} |
    | \33[1;49;97mOS\033[0m            | {os_name} |
    | \33[1;49;97mRAM Usage\033[0m     | {ram} |
    | \33[1;49;97mCPU Usage\033[0m     | {cpu} |
    | \33[1;49;97mDisk Usage\033[0m    | {disk} |
    └────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────┐
    | FRAMEWORK INFO| DESCRIPTION                        |
    |----------------------------------------------------|
    | \33[1;49;97mName\033[0m          | \33[1;49;96mPH0MBER\033[0m                            |
    | \33[1;49;97mVersion\033[0m       | {ver} |
    | \33[1;49;97mType\033[0m          | \33[1;49;96mOSINT\033[0m                              |
    | \33[1;49;97mAuthor\033[0m        | \33[1;49;96ms41r4j\033[0m                             |
    | \33[1;49;97mGithub\033[0m        | \33[1;49;96mhttps://github.com/s41r4j/phomber\033[0m  |
    └────────────────────────────────────────────────────┘
    '''

    help = '''
    ┌────────────────────────────────────────────────────┐
    | COMMANDS      | DESCRIPTION                        |
    |----------------------------------------------------|
    |                <Basic Commands>                    |
    |----------------------------------------------------|
    | \33[1;49;97mhelp\033[0m          | Display this help menu             | 
    | \33[1;49;97mexit/quit\033[0m     | Exit the framework                 |
    | \33[1;49;97mdork\033[0m          | Show a random google dork query    |  
    | \33[1;49;97mexp\033[0m           | Show info about all available      |       
    |               | expressions                        |
    | \33[1;49;97mcheck\033[0m         | Check internet connection          |
    | \33[1;49;97mclear\033[0m         | Clear screen                       |
    | \33[1;49;97msave\033[0m          | Save output of previous scanner    |
    |               | command in a file                  |
    | \33[1;49;97mshell <cmd>\033[0m   | Execute native shell/cmd commands  |
    | \33[1;49;97minfo\033[0m          | Show info about framework & system |
    | \33[1;49;97mchange\033[0m        | Change user command input color    |
    |----------------------------------------------------|
    |                 <Scanner Commands>                 |
    |----------------------------------------------------|
    | \33[1;49;97mnumber\033[0m        | Reverse phone number lookup        |
    | \33[1;49;97mip\033[0m            | Reverse ip address lookup          |
    | \33[1;49;91mMORE SCANNERS COMING SOON, THIS IS A BETA VER\033[0m      |
    └────────────────────────────────────────────────────┘

    \33[1;49;93m> Type `help <command>` to see more info about a command\033[0m
    \33[1;49;93m> Use `Tab` key to auto-complete commands\033[0m
    \33[1;49;93m> Try silent mode by using `-s`/`--silent` flag\033[0m'''

    # Previous command
    prv_cmd = ''
    global prv_op

    # Setting up auto-complete
    readline.parse_and_bind('tab: complete')
    readline.set_completer(completer)

    # Command prompt color
    cmd_color = ['\33[1;49;90m', '\33[1;49;97m']
    crt_color = cmd_color[1]

    # Control center loop
    while True:
        # [user@phomber]⸺[:D] $
        cmd = (printit(f'\n[{user.strip()}@ph0mber]⸺ [{crt_exp}] $ {crt_color}', input_mode=True, space_up=True)).strip()

        if cmd == 'help':
            crt_exp = exp[1]
            prv_op = ''
            print(help)
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
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `number`, it will perform reverse phone number lookup
    \33[1;49;92m> SYNTAX: \33[1;49;97mnumber <phone_number>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mnumber +1234567890
    \033[0m'''
                    print(number_help)
                elif cmd == 'email':
                    crt_exp = exp[1]
                    email_help = f'''  \33[1;49;93m[+] Command Info: \33[1;49;93memail\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `email`, it will perform reverse email lookup
    \33[1;49;92m> SYNTAX: \33[1;49;97memail <email_address>
    \33[1;49;92m> EXAMPLE: \33[1;49;97memail {user.strip()}\33[1;49;96m@gmail.com
    \033[0m'''
                    print(email_help)
                elif cmd == 'ip':
                    crt_exp = exp[1]
                    ip_help = '''  \33[1;49;93m[+] Command Info: \33[1;49;93mip\n
    \33[1;49;92m> DESCRIPTION: \33[1;49;97mWhen you type `ip`, it will perform reverse ip address lookup
    \33[1;49;92m> SYNTAX: \33[1;49;97mip <ip_address>
    \33[1;49;92m> EXAMPLE: \33[1;49;97mip 8.8.8.8
    \033[0m'''
                    print(ip_help)
                else:
                    crt_exp = exp[3]
                    printit('    [!] Invalid sub-command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
            prv_op = ''

        # Basic commands
        elif cmd == 'exit' or cmd == 'quit':
            printit('    [@] Thank you for using `PH0MBER` osint framework :)', coledt=[1, 49, random.choice([92, 96, 97])])
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
                requests.get('https://www.google.com/')
                printit('    > Internet connection is available!', coledt=[1, 49, 92])
                try:
                    public_ip = requests.get('https://httpbin.org/ip').json()['origin']
                except:
                    try:
                        public_ip = requests.get('https://ident.me').text
                    except:
                        try:
                            public_ip = requests.get('https://api.ipify.org').text
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
                    printit('\n    > Command execution failed!', coledt=[1, 49, 91])
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
            if (cmd+'#')[6]  == ' ':
                cmd = cmd[7:]
                printit('    [+] Performing reverse phone number lookup...', coledt=[1, 49, 93], space_down=True)
                if number_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
            else:
                crt_exp = exp[3]
                printit('    [!] Invalid command! Type `help` to see all available commands.', coledt=[1, 49, 91])
        elif cmd == 'ip':
            crt_exp = exp[2]
            printit('    > No ip address found! Type `help ip` to see more info', coledt=[1, 49, 91])
        elif cmd[:2] == 'ip':
            if (cmd+'#')[2]  == ' ':
                cmd = cmd[3:]
                printit('    [+] Performing reverse ip address lookup...', coledt=[1, 49, 93], space_down=True)
                if ip_lookup(cmd):
                    crt_exp = exp[4]
                else:
                    crt_exp = exp[3]
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
        if sys.argv[1] == '-s' or sys.argv[1] == '--silent':
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

# if __name__ == '__main__':
#     main()