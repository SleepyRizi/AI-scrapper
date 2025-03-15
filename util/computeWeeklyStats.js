// File: src/utils/computeWeeklyStats.js

export function computeWeeklyStats(latestBatch) {
    let totalNewProspects = 0;
    let totalOpenProspects = 0;
    let totalNewContent = 0;
    let totalOpenContent = 0;
    let totalNewChanges = 0;
    let totalOpenChanges = 0;
  
    // We'll build some HTML snippet summarizing each domain
    let summaryHtml = '';
  
    for (const competitor of latestBatch) {
      const domain = competitor.domain;
  
      // ----- 1) "Top_Resellers" -----
      const topResellersPrompt = competitor.prompts?.find((p) => p.promptName === 'Top_Resellers');
      const resellers = topResellersPrompt?.result?.resellers || [];
      // Count "new" status
      const newPros = resellers.filter((r) => r.status?.toLowerCase() === 'new').length;
      // Count "open" as prospect/unqualified/customer
      const openPros = resellers.filter((r) =>
        ['prospect', 'customer', 'unqualified'].includes(r.status?.toLowerCase() || '')
      ).length;
      totalNewProspects += newPros;
      totalOpenProspects += openPros;
  
      // ----- 2) "Top_Web_Menthions" -----
      const mentionsPrompt = competitor.prompts?.find((p) => p.promptName === 'Top_Web_Menthions');
      const mentions = mentionsPrompt?.result?.web_mentions || [];
      const newMentions = mentions.filter((m) => m.status?.toLowerCase() === 'unread').length;
      const openMentions = mentions.filter((m) => m.status?.toLowerCase() === 'read').length;
      totalNewContent += newMentions;
      totalOpenContent += openMentions;
  
      // ----- 3) "Website_Extractor" -----
      const extractorPrompt = competitor.prompts?.find((p) => p.promptName === 'Website_Extractor');
      const extResult = extractorPrompt?.result;
      let newChanges = 0;
      let openChanges = 0;
      if (extResult?.changes) {
        const { added = [], removed = [], modified = [] } = extResult.changes;
        const isUnread = (item) => !item.status || item.status.toLowerCase() === 'unread';
        const isRead = (item) => item.status?.toLowerCase() === 'read';
        newChanges += added.filter(isUnread).length;
        newChanges += removed.filter(isUnread).length;
        newChanges += modified.filter(isUnread).length;
        openChanges += added.filter(isRead).length;
        openChanges += removed.filter(isRead).length;
        openChanges += modified.filter(isRead).length;
      }
      totalNewChanges += newChanges;
      totalOpenChanges += openChanges;
  
      // ---- Summarize this domain in HTML ----
      summaryHtml += `
        <div style="margin-bottom: 16px; border: 1px solid #ccc; padding: 8px;">
          <h4 style="margin: 0 0 4px 0;">Domain: ${domain}</h4>
          <ul style="margin: 0; padding-left: 16px; font-size: 14px;">
            <li>New Prospects: ${newPros}</li>
            <li>Open Prospects: ${openPros}</li>
            <li>New Content: ${newMentions}</li>
            <li>Open Content: ${openMentions}</li>
            <li>New Changes: ${newChanges}</li>
            <li>Open Changes: ${openChanges}</li>
          </ul>
        </div>
      `;
    }
  
    return {
      totalNewProspects,
      totalOpenProspects,
      totalNewContent,
      totalOpenContent,
      totalNewChanges,
      totalOpenChanges,
      summaryHtml,
    };
  }
  