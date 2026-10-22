from pathlib import Path
import json, zipfile, hashlib, csv
SUB=Path(__file__).resolve().parent.parent
EVIDENCE=SUB/'evidence'
ROOT=SUB.parent/'emergency-resource-allocation'

notes='''ReliefPlan AI verification notes
Date: 16 October 2026

Existing test suite
Command: C:\\Python313\\python.exe -m pytest tests -v
Observed result: 24 passed, 1 warning in 19.94s
The warning is a pandas FutureWarning from core/explain.py line 141.
All tests in the five supplied test modules passed.

React build
Command: bundled Node executable node_modules/vite/bin/vite.js build
Vite version: 8.3.2
1938 modules transformed
dist/index.html                   0.45 kB, gzip 0.29 kB
dist/assets/index-DMLhl846.css   26.60 kB, gzip 9.03 kB
dist/assets/index-D8iwmJ7A.js   403.65 kB, gzip 122.81 kB
Observed result: build completed in 821ms

Evidence capture
Run capture_outputs.py with the project Python environment.
This script executes the core pipeline, transportation and SHAP routines,
then invokes FastAPI handlers directly using Pydantic request objects.
It does not perform HTTP or browser end to end testing.
New analysis audit records are redirected to verification_audit.csv.
The source, input CSVs, model artifacts and original audit log are preserved.
Model metrics are from the supplied models/metrics.json, not new training.

Known behavior confirmed by comparison
Changing stock inputs in the API analysis to 1 leaves returned allocations
unchanged because total_quantity is updated while quantity is consumed.
See api_analysis.json and api_low_stock_inputs.json.
'''
(EVIDENCE/'verification_notes.txt').write_text(notes,encoding='utf-8')
readme='''ReliefPlan AI code and output submission

Contents
- ReliefPlan_AI_Project_Submission.docx: implementation report and selected code listings
- emergency-resource-allocation/: complete supplied source, CSV data, trained models and tests
- evidence/: captured JSON output, allocation CSVs and reproduction script
- SHA256SUMS.txt: checksums for all other packaged files

Run the project from emergency-resource-allocation.

Python setup in PowerShell
  python -m venv .venv
  .\\.venv\\Scripts\\Activate.ps1
  python -m pip install -r requirements.txt
  python -m pip install fastapi uvicorn
  python -m pytest tests -v

React interface
  python -m uvicorn api:app --host 127.0.0.1 --port 8000
In another terminal, enter emergency-resource-allocation/frontend:
  npm ci
  npm run dev -- --host 127.0.0.1

Streamlit alternative
  streamlit run app/Home.py

Reproduce outputs from the extracted archive root
  python evidence/capture_outputs.py

The reproduction script uses installed project dependencies and writes new output
to evidence. It appends verification records to a separate audit file.
Saved model artifacts are already supplied. Optional retraining with
python core/model.py replaces models and metrics.

Read the report limitations before demonstrating the prototype. In particular,
API stock inputs currently do not update allocation supply; the displayed
25 percent floor is not enforced; simulation reloads its own default baseline;
dispatch and broadcast buttons only change client state.

Original README files and earlier modules are preserved as source material.
The report describes the current code and distinguishes core and API results.
Generated frontend dist, node_modules, Python caches and QA renders are excluded.
'''
entries={}
exclude={'.git','node_modules','dist','__pycache__','.pytest_cache','.venv','venv'}
for path in sorted(ROOT.rglob('*')):
    if path.is_file() and not any(x in exclude for x in path.relative_to(ROOT).parts):
        entries['emergency-resource-allocation/'+path.relative_to(ROOT).as_posix()]=path.read_bytes()
allowed={'.json','.csv','.png','.txt'}
for path in sorted(EVIDENCE.iterdir()):
    if path.is_file() and (path.suffix in allowed or path.name=='capture_outputs.py'):
        if path.name=='document_structure.json': continue
        entries['evidence/'+path.name]=path.read_bytes()
entries['ReliefPlan_AI_Project_Submission.docx']=(SUB/'ReliefPlan_AI_Project_Submission.docx').read_bytes()
entries['README_SUBMISSION.txt']=readme.encode('utf-8')
manifest='\n'.join(hashlib.sha256(data).hexdigest()+'  '+name for name,data in sorted(entries.items()))+'\n'
entries['SHA256SUMS.txt']=manifest.encode()
archive=SUB/'ReliefPlan_AI_Code_and_Output.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(entries.items()): z.writestr(name,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for line in manifest.splitlines():
        digest,name=line.split('  ',1)
        assert hashlib.sha256(z.read(name)).hexdigest()==digest
normal=json.loads((EVIDENCE/'api_analysis.json').read_text())
low=json.loads((EVIDENCE/'api_low_stock_inputs.json').read_text())
assert normal['areas']==low['areas']
print(json.dumps({'archive':str(archive),'files':len(entries),'bytes':archive.stat().st_size,'checksums':'all passed','stock_input_comparison':'confirmed unchanged'},indent=2))
