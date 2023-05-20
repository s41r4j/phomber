##########################################################
#    Project: PH0MBER                                    #
#    Developer: S41R4J                                   #
#    Project Link: https://github.com/s41r4j/phomber     #
# ------------------------------------------------------ #
#    pwd: phomber.modules.apis.numlookupapi              #
#    API's website: numlookupapi.com                     #
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
    return parser.get('numlookupapi.com', 'apikey')
  except configparser.NoOptionError:
    return 'err-nlu-no-apikey'
  except:
    return 'err-nlu-apikey'

    
# getting phone number details from api
def api(phone_number):
  if phone_number:
    apikey = get_apikey()
  
    if apikey == 'err-nlu-no-apikey' or apikey == 'err-nlu-apikey':
      return apikey
  
    url = f"https://api.numlookupapi.com/v1/validate/{phone_number}?apikey={apikey}"
  
    response = requests.get(url)
    
    status_code = response.status_code
    result = response.content
  
    if status_code == 200:
      return json.loads(result.decode('utf-8'))
    else:
      return 'status-code-non-200'