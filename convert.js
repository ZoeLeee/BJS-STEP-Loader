
const fs = require("fs");
const path = require("path");

const [file, filePath] = process.argv.slice(2)

const map = ["a", "g", "{", "}", ".", "c", "e", "u", "i", "n"]

const pathInfo = path.parse(filePath);

if (filePath) {
    let content = fs.readFileSync(path.join(__dirname, filePath), { encoding: "utf-8" });
  
    let newContent = ""
    for (let i = 0; i < 2000; i++) {
        const s = content[i];
        if(!isNaN(parseFloat(s))){
            newContent += map[parseFloat(s)];
        }
        else{
            const index = map.indexOf(s);
            if (index === -1) {
                newContent += s;
            }
            else
            {
                newContent += index;
            }
        }
   
    }

    newContent+=content.slice(2000)

    fs.writeFileSync(path.join(__dirname, pathInfo.dir, pathInfo.name + "_1" + pathInfo.ext), newContent);
}   