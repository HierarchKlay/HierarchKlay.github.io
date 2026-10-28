import {shuffled} from './core.mjs';

// Give Chinese-to-Japanese recall 6 of every complete 10-question mixed round.
// Short queues round up; word selection and due-ordering are handled separately.
export function mixedQuizModes(words,hasAudio=true,random=Math.random){
  const reverseCount=Math.ceil(words.length*.6);
  const others=shuffled(['recall','reading','cloze',hasAudio?'listen':'cloze'],random);
  const plan=shuffled([
    ...Array(reverseCount).fill('reverse'),
    ...Array.from({length:words.length-reverseCount},(_,i)=>others[i%others.length]),
  ],random);
  // A kana-only headword would reveal a reading answer; use a cloze instead.
  return plan.map((type,i)=>type==='reading'&&!/[\u4e00-\u9fff]/.test(words[i].word)?'cloze':type);
}
