from setuptools import setup, find_packages
import os

VERSION = '3.0.0'
DESCRIPTION = 'nothing'
LONG_DESCRIPTION = '''
nothing
'''

# Setting up
setup(
    name="phomber",
    version=VERSION,
    author="s41r4j",
    description=DESCRIPTION,
    long_description=LONG_DESCRIPTION,
    long_description_content_type='text/markdown',
    url='https://github.com/s41r4j/',
    include_package_data=True,
  
    packages=['phomber',
              'phomber.modules', 
              'phomber.modules.basic', 
              'phomber.modules.apis'],

    py_modules=['phomber.modules.basic.config_editor',
                'phomber.phomber',
               'phomber.modules.basic.local_scan',
               'phomber.modules.basic.common'],
  
    install_requires=['phonenumbers==8.12.48',
                      'rich',
                      'geopy==2.2.0',
                      'mechanize==0.4.8',
                      'bs4==0.0.1 ',
                      'pytz==2022.1 '],
  
    keywords=['phomber', 's41r4j', 'phone', 'number', 'reverse', 'search', 'lookup'],
  
    entry_points={"console_scripts": [
        "phomber=phomber.__main__:run_phomber",
    ]},
  
    classifiers=[
        "Programming Language :: Python :: 3", "Operating System :: Unix",
        "Operating System :: MacOS :: MacOS X",
        "License :: OSI Approved :: MIT License"
    ])