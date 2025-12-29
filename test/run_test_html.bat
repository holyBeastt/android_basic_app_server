@echo off
.venv\Scripts\python.exe -m pytest --html=report.html --self-contained-html %*
echo.
echo Report saved to: report.html
start report.html
