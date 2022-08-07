phomber_phoneinfoga_support () {
  echo ====================================
  echo Phomber - phoneinfoga support 
  echo ====================================
  echo https://github.com/s41r4j/phomber
  read -t 2 -p "==================================="
  echo =
  echo _
  curl -L "https://github.com/sundowndev/phoneinfoga/releases/download/v2.3.8/phoneinfoga_$(uname -s)_$(uname -m).tar.gz" -o phoneinfoga.tar.gz
  tar xfv phoneinfoga.tar.gz
  rm phoneinfoga.tar.gz
  echo _
  echo _
  echo "Phoneinfoga installed (Golang required to run program)"
  echo _
  echo _
  echo Check Out Instruction and Prerequisites here :-
  echo https://github.com/s41r4j/phomber/blob/main/.more/phoneinfoga.md
}

phomber_phoneinfoga_support