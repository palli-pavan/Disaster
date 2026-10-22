from pathlib import Path
import zipfile, hashlib, json, re
from docx import Document
from pypdf import PdfReader

SUB=Path(__file__).resolve().parent.parent
REPORT=SUB/'ReliefPlan_AI_Final_Report.docx'
d=Document(REPORT)
assert all(d.styles[s].font.bold and str(d.styles[s].font.color.rgb)=='000000' for s in ['Title','Heading 1','Heading 2','Heading 3'])
assert not any(re.match(r'^\s*\d+\s{2,}\S',p.text) for p in d.paragraphs if p.style.name=='Program code')
assert len(d.inline_shapes)==5
assert sum(1 for r in d.part.rels.values() if r.target_ref=='https://github.com/palli-pavan/Disaster')>=1
assert len(PdfReader(SUB/'evidence/ReliefPlan_AI_Final_Report.pdf').pages)==31

with zipfile.ZipFile(SUB/'ReliefPlan_AI_Code_and_Output.zip') as old:
    entries={name:old.read(name) for name in old.namelist() if name not in ['SHA256SUMS.txt','README_SUBMISSION.txt','ReliefPlan_AI_Project_Submission.docx']}
entries[REPORT.name]=REPORT.read_bytes()
for image in sorted((SUB/'dashboards').glob('*.jpg')):
    entries['dashboards/'+image.name]=image.read_bytes()

capture={
    'capture_date':'16 October 2026',
    'application':'Running React frontend connected to the local FastAPI backend',
    'inputs':{'disaster_type':'Wildfire','severity':'High','duration_hours':72,'food_input':40000,'water_input':40000,'medical_input':2500,'area_populations':{'Area A':1850,'Area B':2900,'Area C':3300,'Area D':4300,'Area E':3200,'Area F':3800,'Area G':2429}},
    'visible_analysis':{'resident_population':21779,'critical_areas':0,'high_areas':4,'water_coverage_percent':28,'displayed_solver_status':'OPTIMAL'},
    'what_if':{'water_supply_change_percent':-30,'population_change_percent':0,'water_coverage_after_percent':19},
    'notes':['Original full page screenshots are included without alteration.','Dashboard populations differ from Pydantic defaults and the core CSV baseline.','Current UI statements about supply inputs and minimum floors have the limits described in the report.','New screenshot run audit records were isolated from the project audit history.']
}
entries['evidence/dashboard_capture.json']=json.dumps(capture,indent=2).encode()
entries['README_SUBMISSION.txt']='''ReliefPlan AI final report and project submission

GitHub repository
https://github.com/palli-pavan/Disaster

Contents
- ReliefPlan_AI_Final_Report.docx: revised report with black bold headings,
  unnumbered source code, verified results and four dashboard figures.
- dashboards/: original full page screenshots of the running React application.
- emergency-resource-allocation/: Python and React source, data, saved models and tests.
- evidence/: captured output, verification notes and reproduction script.
- SHA256SUMS.txt: checksums for every other packaged file.

Python setup from emergency-resource-allocation
  python -m venv .venv
  .\\.venv\\Scripts\\Activate.ps1
  python -m pip install -r requirements.txt
  python -m pip install fastapi uvicorn
  python -m pytest tests -v

Run the API from emergency-resource-allocation
  python -m uvicorn api:app --host 127.0.0.1 --port 8000

Run the React frontend in a second terminal from frontend
  npm ci
  npm run dev -- --host 127.0.0.1

Streamlit alternative from emergency-resource-allocation
  streamlit run app/Home.py

Reproduce the captured core and handler outputs from the extracted archive root
  python evidence/capture_outputs.py

The report distinguishes the ten area core baseline, API defaults and the
seven area React screenshot scenario. Dashboard capture inputs are recorded
in evidence/dashboard_capture.json. Read the limitations before interpreting
screen claims about minimum allocation, stock quantities or dispatch actions.

Dependencies, caches and generated frontend build files are excluded.
Saved models are already included; retraining replaces model and metric files.
'''.encode()
manifest='\n'.join(hashlib.sha256(data).hexdigest()+'  '+name for name,data in sorted(entries.items()))+'\n'
entries['SHA256SUMS.txt']=manifest.encode()
dest=SUB/'ReliefPlan_AI_Final_Submission.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(entries.items()): archive.writestr(name,data)
with zipfile.ZipFile(dest) as archive:
    assert archive.testzip() is None
    for line in manifest.splitlines():
        digest,name=line.split('  ',1)
        assert hashlib.sha256(archive.read(name)).hexdigest()==digest
print(json.dumps({'report':str(REPORT),'rendered_pages':31,'dashboard_screenshots':4,'headings':'black and bold','code_line_numbers':'removed','github_link':'present','archive':str(dest),'files':len(entries),'archive_bytes':dest.stat().st_size,'checksums':'passed'},indent=2))
