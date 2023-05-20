##########################################################
#    Project: PH0MBER                                    #
#    Developer: S41R4J                                   #
#    Project Link: https://github.com/s41r4j/phomber     #
# ------------------------------------------------------ #
#    pwd: phomber.modules.apis.apilayer                  #
#    API's website: apilayer.com                         #
##########################################################


# Importing default functions
import json
import requests
import configparser


# extracting api key from config file
def get_apikey():
  parser = configparser.ConfigParser()
  parser.read('phomber/modules/config.ini')
  try:
    return parser.get('apilayer.com', 'apikey')
  except configparser.NoOptionError:
    return 'err-lyr-no-apikey'
  except:
    return 'err-lyr-apikey'

    
# getting phone number details from api
def api(phone_number):
  if phone_number:
    url = f"https://api.apilayer.com/number_verification/validate?number={phone_number}"
  
    apikey = get_apikey()
  
    if apikey == 'err-lyr-no-apikey' or apikey == 'err-lyr-apikey':
      return apikey
    
    payload = {}
    headers= {
      "apikey": apikey
    }
    
    response = requests.request("GET", url, headers=headers, data = payload)
    
    status_code = response.status_code
    result = response.text
  
    if status_code == 200:
      return json.loads(result.replace('\n', ''))
    else:
      return 'status-code-non-200'