with open("components/Sidebar.tsx", "r") as f:
    content = f.read()

content = content.replace("Main Pipeline", "MLS Pipeline")
content = content.replace("DFD Pipeline", "DFD Scouter")

off_market_btn = """
                <button 
                    onClick={() => handleNavigate('/off-market-pipeline')} 
                    className={getBtnStyle('/off-market-pipeline')}
                >
                    <Layout size={18} />
                    {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">Off-Market Pipeline</span>}
                </button>
"""

dfd_btn = """                <button 
                    onClick={() => handleNavigate('/jv-pipeline')} 
                    className={getBtnStyle('/jv-pipeline')}
                >"""

content = content.replace(dfd_btn, off_market_btn + dfd_btn)

# also rename `/jv-pipeline` to `/dfd-scouter`
content = content.replace("/jv-pipeline", "/dfd-scouter")

with open("components/Sidebar.tsx", "w") as f:
    f.write(content)
