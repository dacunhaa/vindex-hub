@echo off
REM Vindex Hub - abre o prototipo no navegador.
REM Deixe esta janela aberta enquanto usa o Hub. Para encerrar, feche a janela.
cd /d "%~dp0"
echo.
echo   Vindex Hub - prototipo
echo   Abrindo http://localhost:8080 no navegador...
echo   Para encerrar, feche esta janela.
echo.
start "" "http://localhost:8080"
python -m http.server 8080 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo   Nao foi possivel iniciar. Verifique se o Python esta instalado
  echo   ou se a porta 8080 ja esta em uso.
  pause
)
