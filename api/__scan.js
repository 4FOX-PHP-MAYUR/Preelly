require('dotenv').config({path:'.env'});
const m=require('mongoose');
const Category=require('./models/Category');const FormField=require('./models/FormField');
(async()=>{
  await m.connect(process.env.MONGO_URI);
  const motors=await Category.findOne({name:/^motors$/i}).lean();
  // all descendant category ids under Motors (BFS)
  const ids=[motors._id]; const queue=[motors._id];
  while(queue.length){
    const kids=await Category.find({parentId:queue.shift()}).select('_id').lean();
    kids.forEach(k=>{ids.push(k._id);queue.push(k._id)});
  }
  const scopeKey=f=>[f.categoryId,f.childCategoryId,f.categoryFilterId].map(x=>x?String(x):'-').join('|');
  const models=await FormField.find({categoryId:{$in:ids},fieldName:'modelid',isDeleted:false}).lean();
  const trims =await FormField.find({categoryId:{$in:ids},fieldName:'trimid', isDeleted:false}).lean();
  const trimScopes=new Set(trims.map(scopeKey));
  const catName={}; (await Category.find({_id:{$in:ids}}).select('_id name').lean()).forEach(c=>catName[String(c._id)]=c.name);
  console.log('modelid fields under Motors:',models.length,'| trimid fields:',trims.length);
  let needFix=[];
  for(const mf of models){
    const hasTrim=trimScopes.has(scopeKey(mf));
    const wired=mf.functionName==='getTrimByID';
    console.log(`  ${(catName[String(mf.categoryId)]||mf.categoryId).padEnd(16)} hasTrimSibling=${hasTrim} wired=${wired}`);
    if(hasTrim && !wired) needFix.push(mf._id);
  }
  console.log('\nNEED FIX:',needFix.length,'modelid field(s)');
  require('fs').writeFileSync(process.env.SCRATCH+'/needfix.json',JSON.stringify(needFix.map(String)));
  await m.disconnect();
})();
