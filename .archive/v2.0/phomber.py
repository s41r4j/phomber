##############################
#          PH0MBER           #
#                            #
# An advance pyhton script   #
# that finds phone number    #
# details.                   #
#                            #
##############################
#                            #
# Created by : S41R4J        #
#                            #
# Github :                   #
# https://github.com/s41r4j/ #
#                            #
##############################
#       PH0MBER (v2.0)       #
##############################


# Importing main packages
import phonenumbers, sys, datetime, progressbar, time, mechanize, os

# For geolocation cordinates
from config import key
from opencage.geocoder import OpenCageGeocode

# Phoneinfoga phoneinfoga_support
from config import phoneinfoga_key

# Utilized in external search
from bs4 import BeautifulSoup

# Module for Progress Bar
from tqdm import tqdm

# Importing modules for finding Geolocation, Carrier or Service Provider, Timezone
from phonenumbers import geocoder, carrier, timezone

def target_number():

  # Globalizing variables
  global phone_number

  # Taking input as target number
  phone_number = str(sys.argv[1])

def bar(description):

  # for i in tqdm (range (100), desc=description):
  #     time.sleep(0.01)
  #     pass

  widgets = [description, progressbar.AnimatedMarker()]
  bar = progressbar.ProgressBar(widgets=widgets).start()
      
  for i in range(50):
    time.sleep(0.03)
    bar.update(i)

def line():
    print('-'*45)

def current_time():
  e = datetime.datetime.now()
  time_now = "%s:%s:%s" % (e.hour, e.minute, e.second)

  return(time_now)

def banner():
  print('''
▒█▀▀█ ▒█░▒█ █▀▀█ ▒█▀▄▀█ ▒█▀▀█ ▒█▀▀▀ ▒█▀▀█ 
▒█▄▄█ ▒█▀▀█ █▄▀█ ▒█▒█▒█ ▒█▀▀▄ ▒█▀▀▀ ▒█▄▄▀ 
▒█░░░ ▒█░▒█ █▄▄█ ▒█░░▒█ ▒█▄▄█ ▒█▄▄▄ ▒█░▒█''')


def dev():
  line();print();line()
  print('[#] THANK YOU for using PH0MBER')
  line()
  print('''
[=] Contact us for IMPOROVEMENTS and Fixing BUGS of the PH0MBER.\n
[+] Github    : https://github.com/s41r4j/phomber/
[+] Instagram : https://www.instagram.com/s41r4j/ 
  ''')

#==============================================

def external_search(phone_number):

  mc = mechanize.Browser()
  mc.set_handle_robots(False)

  url = 'https://www.findandtrace.com/trace-mobile-number-location'
  mc.open(url)

  mc.select_form(name='trace')
  mc['mobilenumber'] = phone_number # Enter a mobile number
  res = mc.submit().read()

  soup = BeautifulSoup(res,'html.parser')
  tbl = soup.find_all('table',class_='shop_table')
  #print(tbl)

  data = tbl[0].find('tfoot')
  c=0
  for i in data:
      c+=1
      if c in (1,4,6,8):
          continue
      th = i.find('th')
      td = i.find('td')
      try:
        print('[+]',th.text,td.text)
      except AttributeError:
        pass

  data = tbl[1].find('tfoot')
  c=0
  for i in data:
      c+=1
      if c in (2,20,22,26): 
          th = i.find('th')
          td = i.find('td')
          print('[+]',th.text,td.text)

#==============================================

def phoneinfoga_scan(phone_number):

  if phoneinfoga_key == 'Y' or phoneinfoga_key == 'y' :
    
    try:
      if os.path.isfile('./phoneinfoga'):
        try:
          command = f'./phoneinfoga scan -n {phone_number}'
          os.system(command)  
        except:
          print('[!] Phoneinfoga Scan Error\n[-] Please create a issue at:\n    [https://github.com/s41r4j/phomber/issues]\n[-] With steps to reproduce the error !!')

      else:
        try:
          if os.path.isfile('./phoneinfoga.sh'):
            os.system('bash phoneinfoga.sh')
          else:
            if os.path.isfile('./phoneinfoga.bat'):
              os.system('./phoneinfoga.bat')
          print()
          print()
          
          try:
            command = f'./phoneinfoga scan -n {phone_number}'
            os.system(command)  
          except:
            print('[!] Phoneinfoga Scan Error\n[-] Please create a issue at:\n    [https://github.com/s41r4j/phomber/issues]\n[-] With steps to reproduce the error !!')

        except:
          print('[!] Phoneinfoga support - installation files missing,\n[-] Please clone/download the phomber again !!')

    except:
      print("[!] Setup not done properly\n[-] Please check Instructions at:\n    [https://github.com/s41r4j/phomber/blob/main/.more/phoneinfoga.md]\n[-] Please create a issue at:\n    [https://github.com/s41r4j/phomber/issues]\n[-] With steps to reproduce the error !!")

  else:
    print("[-] 'Phoneinfoga Scan' is turned OFF\n[-] Setup Instructions are given in config.py to turn it ON")    


#==============================================

def getting_details():

  line()
  print(f'[#] Scanned [{phone_number}] @ [{current_time()}]')
  line()

  try:
    # Phone number format: (+Countrycode)xxxxxxxxxx
    phone_number_details = phonenumbers.parse(phone_number)

    # Extracting number without Country Code
    global only_number
    split_pnd = str(phone_number_details).split('Number:', 1)

    only_number = split_pnd[1].replace(' ', '')

  except:
    print('[!] Country Code Missing\n')
    print('[TIP] Use plus sign (+), before your two\ndigit country code {Example: +91, +44, +1} ')
    line()
    sys.exit()

  # Validating a phone number
  valid = phonenumbers.is_valid_number(phone_number_details)
    
  # Checking possibility of a number
  possible = phonenumbers.is_possible_number(phone_number_details)

  if valid == True and possible == True:

    print();line()
    print('[$] Basic Results')
    line()
    
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

    print('[+] Timezone          : ', timezone_details)
    print('[+] Service Provicer  : ', service_provider)
    print('[+] Country           : ', geolocation)

    if key:

      try:
        # Finding cordinates of country
        ocd_geocoder = OpenCageGeocode(key)
        query = str(geolocation)

        results = ocd_geocoder.geocode(query)

        lat = results[0]['geometry']['lat']
        lng = results[0]['geometry']['lng']

        google_maps_link = "https://www.google.com/maps/place/"+lat+","+lng

        print('[+] Latitude          : ', lat)
        print('[+] Longutude         : ', lng)
        print('[+] Google Maps Link  : ', google_maps_link)

      except:
        print('\n[-] Entered Invaild API')
        print("[-] Instructions are givien in config file.")

    else:
      print("\n[-] Enter API key in 'config.py'")
      print("[-] Instructions are givien in config file.")
      

  else :
    print('[!] Invalid Number Detected')
    line()
    sys.exit()

#==============================================

def main():
  banner()
  target_number()
  bar('Validating Number ')
  getting_details()
  line();print();line()
  print('[$] Advance Results (Experimental)')
  line()
  try:
    external_search(only_number)
  except IndexError:
    print('[!] Got Unexpected Error\n\n[Tip] Please report any error on the github\n page (https://github.com/s41r4j/phomber) &\n stpes to reproduce same error and HELP US\n to improve the tool for better.')

  line();print();line()
  print('[$] Phoneinfoga Scan Results')
  line()
  phoneinfoga_scan(phone_number)
  line();print();line()
  print('[Truecaller scan] comming soon')
  
  dev()
  line()


if __name__ == '__main__':
  main()

#---------------------------------------------------