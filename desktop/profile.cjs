const fs=require('node:fs'),path=require('node:path');
function profilePath(appData,exists=fs.existsSync){
 const legacy=path.join(appData,'Warborn');
 return exists(legacy)?legacy:path.join(appData,'Acadania');
}
module.exports={profilePath};
