:: RUN THE FILE [phoneinfoga.bat] IN POWERSHELL

@echo off

call :phomber_phoneinfoga_support

:phomber_phoneinfoga_support
echo ====================================
echo Phomber - phoneinfoga support
echo ====================================
echo https://github.com/s41r4j/phomber
echo ====================================
echo _
echo _
curl -L "https://github.com/sundowndev/phoneinfoga/releases/download/v2.3.8/PhoneInfoga_Windows_x86_64.tar.gz" -o phoneinfoga.tar.gz
tar -xf phoneinfoga.tar.gz
DEL  phoneinfoga.tar.gz
echo _
echo _
echo "Phoneinfoga installed (Golang required to run program)"
echo _
echo _
echo Check Out Instruction and Prerequisites here :-
echo https:/\github.com\s41r4j\phomber\blob\main\%CD%more\phoneinfoga.md
exit