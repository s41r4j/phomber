# Importing main module
from phomber.phomber import main

# Used to run phomber as cli application
def run_phomber():
    try:
      main()
    except KeyboardInterrupt:
      print('[!] Force Terminate')