# Importing cmd line argument modules
import argparse
import sys
import os
import math

# For phone number validation
import phonenumbers

# Import version number
import phomber.__init__ as i

# Imports needed for loading animation
from itertools import cycle
from shutil import get_terminal_size
from threading import Thread
from time import sleep



# https://stackoverflow.com/questions/22029562/python-how-to-make-simple-animated-loading-while-process-is-running?answertab=trending#tab-top
class Loader:
    def __init__(self, desc="Loading...", end=f"  [prog=\033[1m{i.__project__}\033[0m; dev=\033[1m{i.__dev__}\033[0m; ver=\033[1m{i.__version__}\033[0m]\n", timeout=0.1):
        self.desc = desc
        self.end = end
        self.timeout = timeout

        self._thread = Thread(target=self._animate, daemon=True)
        self.steps = ["⢿", "⣻", "⣽", "⣾", "⣷", "⣯", "⣟", "⡿"]
        self.done = False

    def start(self):
        self._thread.start()
        return self

    def _animate(self):
        for c in cycle(self.steps):
            if self.done:
                break
            print(f"\r{self.desc} {c}", flush=True, end="")
            sleep(self.timeout)

    def __enter__(self):
        self.start()

    def stop(self):
        self.done = True
        cols = get_terminal_size((80, 20)).columns
        print("\r" + " " * cols, end="", flush=True)
        print(f"\r{self.end}", flush=True)

    def __exit__(self, exc_type, exc_value, tb):
        # handle exceptions with those variables ^
        self.stop()


def loading(text, range_value, sleep_time):
  with Loader(text):
        for z in range(range_value):
            sleep(sleep_time)
      

def display_help():
  global parser
  parser.print_help(sys.stderr)


def parser():

  # specific_api_help = '''
  # \t 1) Abstract Api    [abstractapi.com]
  # \t 2) Apilayer        [apilayer.com]
  # \t 3) Find and Trace  [findandtrace.com]
  # \t 4) Numlookup Api   [numlookupapi.com]
  # \t 5) Veriphone       [veriphone.io]
  # '''
  
  global parser
  
  parser = argparse.ArgumentParser(description='PH0MBER — reverse phone number lookup')
  
  parser.add_argument('phone_number', metavar='Phone Number', 
                      type=str, nargs='?',
                      help='Phone number to which perform reverse lookup')
  
  parser.add_argument('-c', '--config_editor', dest='config_editor', 
                      action='store_true',
                      help='Opens config editor for entering apis keys')

  parser.add_argument('-l', '--logo', dest='display_logo', 
                      action='store_true',
                      help='Display random `PH0MBER` logo')

  parser.add_argument('-a', '--all_apis', dest='all_apis', 
                      action='store_true',
                      help='Run all API scans')

  # parser.add_argument('-s', '--specific_api', dest='s_api', 
  #                     action='store_true',
  #                     help=specific_api_help)
  
  # -- API start --
  parser.add_argument('-abs', '--abstractapi', dest='abstractapi', 
                      action='store_true',
                      help="Abstract Api [abstractapi.com]")

  parser.add_argument('-lyr', '--apilayer', dest='apilayer', 
                      action='store_true',
                      help="Apilayer [apilayer.com]")

  parser.add_argument('-fnt', '--findandtrace', dest='findandtrace', 
                      action='store_true',
                      help="Find and Trace [findandtrace.com]")

  parser.add_argument('-nlu', '--numlookupapi', dest='numlookupapi', 
                      action='store_true',
                      help="Numlookup Api [numlookupapi.com]")

  parser.add_argument('-vp', '--veriphone', dest='veriphone', 
                      action='store_true',
                      help="Veriphone [veriphone.io]")
  # -- API end --
  
  return parser.parse_args()  



def get_width():
  return os.get_terminal_size()[0]


def decorate(func, title, value, api_code=False):
  
  def wrapper():
    print('—'*get_width())
    half_width = math.floor((get_width() - len(title))/2)-1
    print('~'*half_width, title, '~'*half_width)
    print('—'*get_width())

    try:
      data = func(value)
      if data != 'status-code-non-200' and api_code:
        process_data(data, api_code)
    except:
      print('err-decorator')

    print('—'*get_width(), '\n') 
    
  return wrapper


# Function to process json data retrived from apis 
def process_data(data, api_code):
  if api_code == 'abs':
        print('[+] Phone Number\n    |—[ International format:', data['format']['international'], ']\n    |—[ Local format:', data['format']['local'],']')
        print('\n[+] Validity\n    |—[ The provide numeber is', 'VALID' if data['valid'] else 'INVALID',']')
        print('\n[+] Country\n    |—[ Code:', data['country']['code'], ']\n    |—[ Name:', data['country']['name'], ']\n    |—[ Prefix:', data['country']['prefix'],']')
        print('\n[+] Other details\n    |—[ Line type:', data['type'], ']\n    |—[ Carrier:', data['carrier'], ']')
    
  elif api_code == 'lyr' or api_code == 'nlu':
        print('[+] Phone Number\n    |—[ International format:', data['international_format'], ']\n    |—[ Local format:', data['local_format'],']')
        print('\n[+] Validity\n    |—[ The provide numeber is', 'VALID' if data['valid'] else 'INVALID',']')
        print('\n[+] Country\n    |—[ Code:', data['country_code'], ']\n    |—[ Name:', data['country_name'], ']\n    |—[ Prefix:', data['country_prefix'], ']\n    |—[ Location:', data['location'],']')
        print('\n[+] Other details\n    |—[ Line type:', data['line_type'], ']\n    |—[ Carrier:', data['carrier'],']')

  elif api_code == 'vp':
        print('[+] Phone Number\n    |—[ International format:', data['international_number'], ']\n    |—[ Local format:', data['local_number'],']')
        print('\n[+] Validity\n    |—[ The provide numeber is', 'VALID' if data['phone_valid'] else 'INVALID',']')
        print('\n[+] Country\n    |—[ Code:', data['country_code'], ']\n    |—[ Name:', data['country'], ']\n    |—[ Prefix:', data['country_prefix'], ']\n    |—[ Location:', data['phone_region'],']')
        print('\n[+] Other details\n    |—[ Line type:', data['phone_type'], ']\n    |—[ Carrier:', data['carrier'],']')



# Number valid or invalid
def is_valid(phone_number):
  phone_number_details = phonenumbers.parse(phone_number)
  valid = phonenumbers.is_valid_number(phone_number_details)
  possible = phonenumbers.is_possible_number(phone_number_details)

  if valid and possible:
    return True
  else:
    return False