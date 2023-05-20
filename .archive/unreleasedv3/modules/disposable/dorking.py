# under development

import requests
from bs4 import BeautifulSoup
from googlesearch import search

number = '+16463484474' #temp

foundnumbers = []

def duckduckgo_sites():
  URL = "https://duckduckgo.com/html/?q=disposablenumbers"
  USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:65.0) Gecko/20100101 Firefox/65.0"
  headers = {"user-agent" : USER_AGENT}
  resp = requests.get(URL, headers=headers)
  if resp.status_code == 200:
	  soup = BeautifulSoup(resp.content, "html.parser")
	  results = []
	  for g in soup.find_all('h2', class_='result__title'):
		  anchors = g.find_all('a')
		  if anchors:
			  link = anchors[0]['href']
			  results.append(link)
  return results

def google_sites():
  URL = "https://www.google.com/search?q=disposablenumbers"
  USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:65.0) Gecko/20100101 Firefox/65.0"
  headers = {"user-agent" : USER_AGENT}
  resp = requests.get(URL, headers=headers)
  if resp.status_code == 200:
	  soup = BeautifulSoup(resp.content, "html.parser")
	  results = []
	  for g in soup.find_all('h2', class_='result__title'):
		  anchors = g.find_all('a')
		  if anchors:
			  link = anchors[0]['href']
			  results.append(link)
        
  print(results)
  return results

  
def spiderv(num, sites):
    
    crawl = requests.get(sites)

    if num in crawl.text:
        print("[+] Found number in website: ", sites)
    else:
        print("[!] Number not found on website : ", sites)
    
def spider(num, sites):
    
    crawl = requests.get(sites)

    if num in crawl.text:
        foundnumbers.append(sites)


def dorkv(num, sites):

    try:
        for result in search("site:{} intext:{}".format(sites, num), stop=1):
            if result:
                print("[+] Found number in website:" , result)
            else:
                print("[!] Number not found on website: ", result)
    except:
        print("[!] Google being retard once again blocking requests, try using proxy")


def dork(num, sites):

    try:
        for result in search("site:{} intext:{}".format(sites, num), stop=1):
            if result:
                foundnumbers.append(result)

    except:
        print("[!] Google being retard once again blocking requests, try using proxy")


def main():
  # print("\n[*](d) Scanning for disposable numbers...\n")
  # for i in duckduckgo_sites():
  #   dork(number, i)
  #   dorkv(number, i)
  
  # print("\n[*](d) Scanning for disposable numbers.... \n")
  # for i in duckduckgo_sites():
  #   spider(number, i)
  #   spiderv(number, i)

  print("\n[*](g) Scanning for disposable numbers...\n")
  for i in google_sites():
    dork(number, i)
    dorkv(number, i)
  
  print("\n [*](g) Scanning for disposable numbers.... \n")
  for i in google_sites():
    spider(number, i)
    spiderv(number, i)

  
  print(foundnumbers)
  

main()