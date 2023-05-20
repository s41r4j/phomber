#################################################
#                    P0MBER                     #
#                                               #
#  A Infomation Grathering tool that reverse    #
#  search phone numbers and get their details ! #
#                                               #
#################################################
#                                               #
#  Developer: S41R4J                            #
#  Github: github.com/s41r4j/phomber            #
#                                               #
#################################################   
#                                               #
#  Report/raise any issue/bug at  ->            # 
#  https://github.com/s41r4j/phomber/issues     #
#                                               #
#################################################


# ---------------Importing--required--modules--------------------

# Default modules
import sys

# CLI argument parser module
from phomber.modules.basic.common import parser, display_help

# Config Editor Module
from phomber.modules.basic.config_editor import config_editor_start

# Logo module
from phomber.modules.basic import logo

# Decorator Module
from phomber.modules.basic.common import decorate

# Number validator
from phomber.modules.basic.common import is_valid

# Loading animation module 
from phomber.modules.basic.common import loading

# Local scan module
from phomber.modules.basic.local_scan import localscan

# Importing default info
import phomber.__init__ as i

# API Scanning Modules
from phomber.modules.apis import abstractapi
from phomber.modules.apis import apilayer
from phomber.modules.apis import findandtrace
from phomber.modules.apis import numlookupapi
from phomber.modules.apis import veriphone

#-------------------------Functions------------------------------

def main():
  try:
    args = parser()
  
    # Assigning values
    config_editor = args.config_editor
    phone_number = args.phone_number
    dlogo = args.display_logo
    
    # NO Argument Check
    if phone_number == None and not config_editor and not dlogo:
      display_help()
      sys.exit(0)
  
    # Display logo
    if dlogo:
      logo.random_logo()
      sys.exit(0)
    else:
      print(logo.logos[0])
      loading(f'  [prog={i.__project__}; dev={i.__dev__}; ver={i.__version__}]', 5, 0.25)
      
    
    # Edit config file
    if config_editor:
      config_editor_start()
      sys.exit(0)
  
    # Validating number
  
    if not is_valid(phone_number):
      print('[!] PROVIDED NUMBER IS INVALID')
      sys.exit(1)
  
    # Getting only number without country code
    only_number = localscan(phone_number, True)
      
    # Local scan (default)
    local_scan = decorate(localscan, 'Basic Scan', phone_number)  
    local_scan()
  
    
    # Checking for API scan
    if args.all_apis:
      args.abstractapi = args.apilayer = args.findandtrace = args.numlookupapi = args.veriphone = True
    
    if args.abstractapi:
      abstract_api = decorate(abstractapi.api, 'abstractapi.com', phone_number, 'abs')
      abstract_api()
        
    if args.apilayer:
      api_layer = decorate(apilayer.api, 'apilayer.com', phone_number, 'lyr')
      api_layer()
  
    if args.findandtrace:
      find_trace = decorate(findandtrace.api, 'findandtrace.com', only_number)
      find_trace()
  
    if args.numlookupapi:
      numlookup_api = decorate(numlookupapi.api, 'numlookupapi.com', phone_number, 'nlu')
      numlookup_api()
  
    if args.veriphone:
      veri_phone = decorate(veriphone.api, 'veriphone.io', phone_number, 'vp')
      veri_phone()

      
  except KeyboardInterrupt:
      print('[!] Force Terminate')

#------------------------------------------------------------------