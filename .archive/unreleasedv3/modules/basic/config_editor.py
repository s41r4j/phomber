import configparser
import os


def get_width():
  return os.get_terminal_size()[0]


# Config Data Editor Menu
def edit_data():
  # Main data editor menu
  while True:
    print('—'*get_width(), '[+] Config Data Editor\n'+'—'*get_width()) 
    data = get_data(False, True)

    keys = []
    for key in data:
      keys.append(key)

    print(f"\n {len(keys)})> Back to Main Menu\n"+'—'*get_width())

    # Inputing option
    try:
      action = int(input('[select to edit] > '))
    except ValueError:
      print('—'*get_width()+'\n\n'+'—'*get_width(), f'\n[!] Select from "0-{len(keys)}"\n'+'—'*get_width())
      continue
    
    print('—'*get_width(), '\n')

    # Editing values menu
    if action>-1 and action<len(data):
      while True:
        value = keys[action]
        lst = data[value]
        
        print('—'*get_width(), f'[+] Editing "{value}" \n'+'—'*get_width())

        for n,l in enumerate(lst):
          print(f'\n{n})>',l[0],'=',l[1])
        print(f'\n{n+1})> Back to Data Editor Menu\n'+'—'*get_width())
        
        # Inputing option
        try:
          edit_val = int(input('[select to edit]> '))
        except ValueError:
          print('—'*get_width()+'\n\n'+'—'*get_width(), f'[!] Select from "0-{n+1}"\n'+'—'*get_width())
          continue
        
        print('—'*get_width(), '\n')
        
        # Editing sub vales menu
        if edit_val>-1 and edit_val<len(lst):
          sub_val = lst[edit_val][0]
          current_val = 'NO VALUE SET' if sub_val == '' else lst[edit_val][1]
            
          print('—'*get_width(), f'[+] Editing "{value}" -> "{sub_val}"\n'+'—'*get_width())
          print(f'\n{sub_val} = {current_val}\n'+'—'*get_width())

          # Taking input new value
          new_val = input('[enter new value]> ')

          # writing input to config file
          parser.set(value, sub_val, new_val)
          with open('phomber/modules/config.ini', 'w') as conf:
            parser.write(conf)
          
          print('—'*get_width(), '\n')
          data = get_data(False, True, False)
          
        elif edit_val == len(lst):
          break
        else:
          print('—'*get_width(), f'[!] Select from "0-{n+1}"\n'+'—'*get_width())  

        
    # Back to Main Menu
    elif action == len(data):
      break
    else:
      print('—'*get_width(), f'[!] Select from "0-{len(data)}"\n'+'—'*50)
    


# Config Data Viewer Menu
def get_data(title=True, return_str=False, display=True):
  data = {}
  var = 0

  if title and display:
    print('—'*get_width(), '[+] Config Data Viewer\n'+'—'*get_width()) 
    
  for sect in parser.sections():
    if display:
      print(f'\n {var})>', sect)
    var+=1
    data[sect] = []
    for k,v in parser.items(sect):
      if display:
        print(f'\t{k} = {v}')
      data[sect].append([k,v])
  
  if return_str:
    return data

  print('—'*get_width()) 


def loop_menu():
  while True:
    print('—'*get_width(), '[+] Main Menu\n'+'—'*get_width()) 
    actions = ['View Data', 'Edit Data', 'Exit Editor']
    for n,a in enumerate(actions):
      print(f'\n {n})> {a}')
    print('—'*get_width()) 

    # Inputing option
    try:
      action = int(input('[select action] > '))
    except ValueError:
      print('—'*get_width()+'\n\n'+'—'*get_width(), f'[!] Select from "0-{n}"\n'+'—'*get_width())
      continue
      
    print('—'*get_width(), '\n')
    
    if action == 0:
      get_data()
    elif action == 1:
      edit_data()
    elif action == 2:
      break
    else:
      print('—'*get_width(), f'[!] Select from "0-{n}"\n'+'—'*get_width())
    

# Main function
def config_editor_start():
  # Read config file
  global parser
  parser = configparser.ConfigParser()
  parser.read('phomber/modules/config.ini')
  
  print('='*get_width(), '[+] Ph0mber Config Editor\n'+'='*get_width())
  
  try:
    loop_menu()
  except KeyboardInterrupt:
    print('\n\n'+'—'*get_width(), '[!] Force Terminate\n'+'—'*get_width())

  print('—'*get_width(), '[+] Exiting Ph0mber Config Editor\n'+'—'*get_width())