# Simple online (search engine) manual scan 

def google_search(phone_number):
  try:
    url = f"https://www.google.com/search?q={phone_number}"
    return url
  except:
    return 'err'

def bing_search(phone_number):
  try:
    url = f"https://www.bing.com/search?q={phone_number}"
    return url
  except:
    return 'err'

def duckduckgo_search(phone_number):
  try:
    url = f"https://duckduckgo.com/{phone_number}"
    return url
  except:
    return 'err'
    
