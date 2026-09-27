// Authored rows: correct option first. The compiler rotates text and audio
// choices together; answer order and explanations never enter the public DTO.
export const q = (prompt, options, explanation, goal=1) => ({prompt,options,explanation,goal});
export const star = (before, ordered, after, goal=1, position=2) => ({
  prompt:`${before} ${ordered.map((_,i)=>i===position?'★':'＿＿').join(' ')} ${after}`,
  options:[ordered[position],...ordered.filter((_,i)=>i!==position)],
  explanation:`Urutan: ${before} ${ordered.join(' ')} ${after} Posisi ★ adalah ${ordered[position]}.`,
  goal, ordered, position,
});
export const passage = (text, questions) => questions.map(item=>({...item,passage:text}));
export const listen = (script, item) => ({...item,audioScript:script});
export const spoken = (script, options, explanation, goal=1, image=false) => ({
  prompt:image?'えを みて、こたえて ください。':'こえを きいて、こたえて ください。',
  audioScript:script,options,explanation,goal,audioOptions:true,
  ...(image?{imageUrl:'/assets/assessments/speakers-ab.svg'}:{}),
});
