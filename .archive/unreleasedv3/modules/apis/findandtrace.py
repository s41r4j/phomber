##########################################################
#    Project: PH0MBER                                    #
#    Developer: S41R4J                                   #
#    Project Link: https://github.com/s41r4j/phomber     #
# ------------------------------------------------------ #
#    pwd: phomber.modules.apis.veriphone                 #
#    API's website: veriphone.io                         #
##########################################################


# Importing need functions
import mechanize
from bs4 import BeautifulSoup


def api(phone_number):
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
  try:
    data = tbl[1].find('tfoot')
  except:
    pass
    
  c=0
  for i in data:
      c+=1
      if c in (2,12,14,18,20,22,24,26,28,30): 
          th = i.find('th')
          td = i.find('td')
          try:
            print('[+]',th.text,td.text.strip())
          except AttributeError:
            pass