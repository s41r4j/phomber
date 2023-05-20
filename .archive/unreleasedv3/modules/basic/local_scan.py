# Module to get phone number detials
import phonenumbers
from phonenumbers import geocoder, carrier, timezone

# Module to locate country coordinates
from geopy.geocoders import Nominatim

# Getting date and time of phone number location
from datetime import datetime
import pytz



def localscan(phone_number, only=False):

  try:
    # Phone number format: (+Countrycode)xxxxxxxxxx
    phone_number_details = phonenumbers.parse(phone_number)

    # Extracting number without Country Code
    split_pnd = str(phone_number_details).split('Number:', 1)

    only_number = split_pnd[1].replace(' ', '')
    
    # Return only number without country code
    if only:
      return only_number

  except:
    print('[!] Country Code Missing\n')
    print('[TIP] Use plus sign (+), before your two\ndigit country code {Example: +91, +44, +1} ')
    return

  # Validating a phone number
  valid = phonenumbers.is_valid_number(phone_number_details)
  
  # Checking possibility of a number
  possible = phonenumbers.is_possible_number(phone_number_details)

  if valid == True and possible == True:
    
    # Creating a phone number variable for country
    counrty_number = phonenumbers.parse(phone_number,'CH')

    # Gives mobile number's location (Country)
    geolocation = geocoder.description_for_number(counrty_number, 'en')

    # Creating a phone number variable for service provider
    service_number = phonenumbers.parse(phone_number,'RO')

    # Gives mobile number's service provider (Airtel, Idea, Jio)
    service_provider = carrier.name_for_number(service_number, 'en')

    # Gives mobile number's timezone
    timezone_details_unfiltered = str(timezone.time_zones_for_number(phone_number_details))

    special_chars = "()'',"
    for special_char in special_chars:
      timezone_details = timezone_details_unfiltered.replace(special_char, '')

    # Gives coordinates of phone nymber's country 
    geolocator = Nominatim(user_agent="MyApp")
    location = geolocator.geocode("Hyderabad")
    lat = location.latitude
    lng = location.longitude

    # Gives date and time of number's location
    timezone_name = timezone_details.replace('(', '').replace(')', '').replace("'", '')
    timezone_obj = pytz.timezone(timezone_name)
    datetime_obj = datetime.now(timezone_obj)
    dateandtime = datetime_obj.strftime('%Y:%m:%d %H:%M:%S')
    date, time = dateandtime.split()
    
    # Displaying output
    print('[+] Timezone           : ', timezone_details)
    print('[+] Local Time         : ', time)
    print('[+] Local Date         : ', date)
    print('[+] Service Provicer   : ', service_provider)
    print('[+] Country            : ', geolocation)
    print('[+] Latitude           : ', lat)
    print('[+] Longutude          : ', lng)

    
