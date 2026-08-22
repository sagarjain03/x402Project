#!/bin/bash
LABEL="$1"; BODY="$2"
echo "════════ $LABEL ════════"
START=$(date +%s)
curl -sN -X POST https://warden-project.vercel.app/api/v1/console/run -H "Content-Type: application/json" -d "$BODY" --max-time 150 | while IFS= read -r l; do
  echo "$l" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);
    if(j.type==='tool-call')console.log('  CALL  '+j.tool+' \$'+j.priceUsd);
    else if(j.type==='tool-result')console.log('  GUARD '+j.outcome+(j.code?' ('+j.code+')':'')+'  '+j.tool);
    else if(j.type==='injection')console.log('  INJECTED: '+String(j.snippet).slice(0,70));
    else if(j.type==='error')console.log('  ERROR: '+j.message);
    else if(j.type==='done'){console.log('  TOTALS spent='+j.spentUsd+' blocked='+j.blockedUsd+' held='+j.heldUsd);console.log('  --- ANSWER ---');console.log(j.answer.split('\n').map(s=>'  '+s).join('\n'))}
  }catch(e){}})"
done
echo "  [closed at $(( $(date +%s) - START ))s]"; echo
