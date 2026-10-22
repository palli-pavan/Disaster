"""Capture project outputs without changing source, models or the original audit log."""
from pathlib import Path
import os, sys, json, platform, importlib.metadata, hashlib, zipfile
from unittest.mock import patch

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent / 'emergency-resource-allocation'
if not ROOT.exists():
    ROOT = OUT.parent.parent / 'emergency-resource-allocation'
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
from core.data import load_all_data, ML_FEATURE_COLS, prepare_ml_dataset
from core.simulate import run_full_pipeline, compute_optimization_impact
from core.optimizer import optimize_transportation_lp
from core.explain import load_model_and_explainer, compute_global_feature_importance, explain_single_area_prediction
from core.audit import log_decision_run
import api

def save(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, default=str), encoding='utf-8')

data = load_all_data()
base = run_full_pipeline(datasets=data)
shock = run_full_pipeline(datasets=data, resource_supply_deltas={'Water': -30.0})
pop = run_full_pipeline(datasets=data, population_delta_pct=25.0)
for name, res in [('baseline',base), ('water_shock',shock), ('population_surge',pop)]:
    res['allocation_df'].to_csv(OUT / f'{name}_allocations.csv', index=False)
    impact = compute_optimization_impact(res['allocation_df'])
    save(f'{name}_summary.json', {k:res[k] for k in ['kpis','coverages','total_demands','total_supplies','solver_statuses','parameters','action_cards','warnings']} | {'impact': {k:v for k,v in impact.items() if k != 'table'}})

routes = optimize_transportation_lp(base['allocation_df'], data['warehouses'], data['resources'])
save('transportation.json', routes)
model, explainer, encoder = load_model_and_explainer()
X = prepare_ml_dataset(data)
importance, _ = compute_global_feature_importance(explainer, X[ML_FEATURE_COLS])
save('global_shap.json', importance)
local = explain_single_area_prediction(explainer, X.iloc[0], base['allocation_df'].iloc[0]['predicted_severity'], class_names=list(encoder.classes_))
save('local_explanation.json', {k:v for k,v in local.items() if k not in ['figure','waterfall_fig']})

def isolated_log(*args, **kwargs):
    kwargs['audit_file_path'] = str(OUT / 'verification_audit.csv')
    return log_decision_run(*args, **kwargs)

with patch.object(api, 'log_decision_run', side_effect=isolated_log):
    statuses = {}
    for method, url, payload, name in [
        ('GET','/api/health',None,'api_health'),
        ('POST','/api/analyze',{},'api_analysis'),
        ('POST','/api/analyze',{'water_supply':1.0,'food_supply':1.0,'med_supply':1.0},'api_low_stock_inputs'),
        ('POST','/api/simulate',{'shock_water_pct':-30,'shock_pop_pct':0},'api_simulation'),
        ('GET','/api/metrics',None,'api_metrics'),
        ('GET','/api/audit',None,'api_audit')]:
        handlers = {'/api/health':api.health_check, '/api/analyze':api.analyze_disaster, '/api/simulate':api.simulate_shock, '/api/metrics':api.get_metrics, '/api/audit':api.get_audit_log}
        req = api.AnalyzeRequest(**payload) if url == '/api/analyze' else api.SimulateRequest(**payload) if url == '/api/simulate' else None
        response = handlers[url](req) if req is not None else handlers[url]()
        statuses[url + (' low stock' if 'low_stock' in name else '')] = 'handler returned successfully'
        save(name+'.json', response)
    save('api_statuses.json', statuses)

save('dataset_inventory.json', {p.name:{'rows': len(__import__('pandas').read_csv(p)), 'columns': list(__import__('pandas').read_csv(p).columns)} for p in sorted((ROOT/'data').glob('*.csv'))})
save('runtime.json', {'python':platform.python_version(), 'platform':platform.platform(), 'packages':{n:importlib.metadata.version(n) for n in ['numpy','pandas','scipy','scikit-learn','xgboost','shap','pytest','fastapi','uvicorn','streamlit','plotly','joblib']}})
print(json.dumps({'baseline':base['kpis'], 'coverage':base['coverages'], 'shock':shock['kpis'], 'routes':routes, 'api_statuses':statuses},indent=2))
