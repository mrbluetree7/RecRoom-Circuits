const fs = require("fs-extra")
const { exit } = require("process")
const https = require('follow-redirects').https
const SVGGen = require("./Create-SVG")

const ChipTemplate = fs.readFileSync("templates/chip.mdx", "utf-8")
const ExtraInfoTemplate = fs.readFileSync("templates/extrainfo.mdx", "utf-8")

const DeprMsg = `:::danger DEPRECATED

This chip has been deprecated. Please move to a different chip.

:::`
const BetaMsg = `:::caution BETA

This chip requires beta content to be enabled in the room. You can access the setting in "This Room -> Settings".

:::`

const TotalSteps = 5
var CurrentStep = 0
var Currentindex = 1

function AddStep(prnt) {
    CurrentStep++
    console.log("[".concat(CurrentStep, "/", TotalSteps, "] ", prnt))
}
function BoolToYesNo(bl) {
    if(bl) return "✅"; else return "❌";
}
const DownloadFile = "Generated/Chips_OLD.json"

const sleep = s => new Promise(r => setTimeout(r, s*1000));

var oldJSON_raw
var OldJSON
var OldJSON_Clone
var entries

var PortTypes = {
    "exec": {
        "HasDefaultValue": false,
        "Model": "Exec",
        "Color": "#F55C1A",
    },
    "string": {
        "HasDefaultValue": true,
        "Model": "Data",
        "Color": "#784283",
    },
    "int": {
        "HasDefaultValue": true,
        "Model": "Data",
        "Color": "#106522",
    },
    "float": {
        "HasDefaultValue": true,
        "Model": "Data",
        "Color": "#186BDD",
    },
    "bool": {
        "HasDefaultValue": true,
        "Model": "Data",
        "Color": "#EA2E50",
    },
    "color": {
        "HasDefaultValue": true,
        "Model": "Data",
        "Color": "#004FB9",
    },
    "player": {
        "HasDefaultValue": true,
        "Model": "Data",
        "Color": "#F5C51F",
    }
}

var NewChips = {}
const template = {
    "HasDefaultValue": false,
    "Model": "Data",
    "Color": "#F5C51F",
}

function RetrievePorts(){
    for(const chip of Object.values(OldJSON)){
        for(const nodedesc of chip["NodeDescs"]){
            let HasParams = false
            if (Object.keys(nodedesc["ReadonlyTypeParams"]).length > 0) {
                HasParams = true
            }
            for(const param of Object.values(nodedesc["ReadonlyTypeParams"])){
                for(const splitstring of param.replace("(", "").replace(")", "").split(" | ")) {
                    if(PortTypes[splitstring.toLowerCase()] === undefined) {
                        PortTypes[splitstring.toLowerCase()] = template
                    }
                }
            }
            for(const port of nodedesc["Inputs"]){
                if(port["ReadonlyType"].includes("List<")){
                    port["ReadonlyType"] = port["ReadonlyType"].replace("List<", "").replace(">", "")
                }
                if(!HasParams){
                    if(PortTypes[port["ReadonlyType"].toLowerCase()] === undefined) {
                        PortTypes[port["ReadonlyType"].toLowerCase()] = template
                    }
                }
            }
            for(const port of nodedesc["Outputs"]){
                if(port["ReadonlyType"].includes("List<")){
                    port["ReadonlyType"] = port["ReadonlyType"].replace("List<", "").replace(">", "")
                }
                if(!HasParams){
                    if(PortTypes[port["ReadonlyType"].toLowerCase()] === undefined) {
                        PortTypes[port["ReadonlyType"].toLowerCase()] = template
                    }
                }
            }
        }
    }
}
function CheckHasFileName(arr, checkr) {
    for (const element of arr) {
        if (element.includes(checkr)) {
            return [true, element]
        }
    }
    return [false]
}

function PrepareFiles() {
    const chps_rw = fs.readFileSync("Generated/chips.json", "utf-8")
    const chps = JSON.parse(chps_rw)
    const entries = Object.entries(chps)
    fs.mkdirSync(__dirname + '/../ExtraInfo/', {recursive: true}, function (err){
        if (err) console.log("error");
    })
    const ExtraInfoDir = fs.readdirSync(__dirname + '/../ExtraInfo/', {}, (err, files) => {
        if (err) {
            console.log(err)
        }
    })
    for(const [uuid, contents] of entries){
        var ExtraInfoFile = ""
        var TagsFile = ""
        const DirPath = __dirname + '/../ExtraInfo/'.concat(contents["ChipName"].replace("<", "[").replace(">", "]"), "@", uuid)
        const FlNm = contents["ChipName"].replace("<", "[").replace(">", "]").concat("@", uuid)
        const [Success, Element] = CheckHasFileName(ExtraInfoDir, uuid)

        if (Success) {
            if (Element != FlNm) {
                fs.renameSync(__dirname + '/../ExtraInfo/' + Element, DirPath)
            }
        } else {
            try {
                fs.mkdirSync(DirPath, {recursive: true}, function (err){
                    if (err) console.log("error");
                })
                fs.writeFileSync(DirPath.concat("/extrainfo.mdx"), ExtraInfoTemplate, { flag: "wx" })
                fs.writeFileSync(DirPath.concat("/tags.txt"), "Chip", { flag: "wx" })
               // fs.writeFileSync(__dirname + '/../ExtraInfo/'.concat(contents["ChipName"].replace("<", "[").replace(">", "]"), "@", uuid, ".md"), ExtraInfoTemplate, { flag: "wx" })
            } catch (error) {
                
            }
        }

        var NewChipFile = ChipTemplate
        var InputsStr = "| Input Name | Input Type |\n|-----------|-----------|"
        var OutputsStr = "| Output Name | Output Type |\n|-----------|-----------|"
        
        try {for(const func of contents["Functions"]) {
            for(const prt of func["Inputs"]) {
                let prtstr = "| ._name | ._type |"
                let newstr = ""
                if(prt["IsUnion"] === true) {
                    var joined = prt["DataType"].join(" , ")
                    newstr = "Union(".concat(joined, ")")
                } else {
                    newstr = prt["DataType"]
                }
                if (prt["IsList"]) {
                    newstr = "List[".concat(newstr, "]")
                }
                if (prt["Name"] == "") {
                    prt["Name"] = "*No name.*"
                }
                InputsStr = InputsStr.concat("\n", prtstr.replace("._name", prt["Name"]).replace("._type", newstr))
            }

            for(const prt of func["Outputs"]) {
                let prtstr = "| ._name | ._type |"
                let newstr = ""
                if(prt["IsUnion"] === true) {
                    var joined = prt["DataType"].join(" , ")
                    newstr = "Union(".concat(joined, ")")
                } else {
                    newstr = prt["DataType"]
                } 
                if (prt["IsList"]) {
                    newstr = "List[".concat(newstr, "]")
                }
                if (prt["Name"] == "") {
                    prt["Name"] = "*No name.*"
                }
                OutputsStr = OutputsStr.concat("\n", prtstr.replace("._name", prt["Name"]).replace("._type", newstr))
            }
        }} catch (error) {
            console.log(error)
        }
        
        NewChipFile = NewChipFile
        .replace("._chipname", contents["ChipName"].replace("<", "[").replace(">", "]"))
        .replace("._istroll", BoolToYesNo(contents["TrollingRisk"]))
        .replace("._isbeta", BoolToYesNo(contents["IsBeta"]))
        .replace("._uuid", uuid)
        .replace("._inputs", InputsStr)
        .replace("._outputs", OutputsStr)
        .replace("._sidebarpos", Currentindex)
        .replace("._extrainfo", fs.readFileSync(DirPath.concat("/extrainfo.mdx"), "utf-8"))
        .replace("._tags", fs.readFileSync(DirPath.concat("/tags.txt"), "utf-8"))

        switch (contents["DeprecationStage"]) {
            case "Deprecated":
                NewChipFile = NewChipFile.replace("._depr", DeprMsg)
                break;
        
            default:
                if (contents["IsBeta"]) {
                    NewChipFile = NewChipFile.replace("._depr", BetaMsg)
                } else {
                    NewChipFile = NewChipFile.replace("._depr", "")
                }
                break;
        }
        if(contents["Description"] !== "") {
            NewChipFile = NewChipFile.replace("._chipdesc", contents["Description"].replace("<", "[").replace(">", "]"))
        } else NewChipFile = NewChipFile.replace("._chipdesc", "*No description.*")

        fs.unlink(__dirname + '/../Circuits/docs/documentation/chips/'.concat(uuid, ".md"), (err) => { if (err) { throw err }});
        fs.writeFileSync(__dirname + '/../Circuits/docs/documentation/chips/'.concat(uuid, ".mdx"), NewChipFile);

        Currentindex++
    }
}

function TranslateChipData(){
    for(const [uuid, chipd] of entries) {
        // Order: List<> removal -> Param checker
        const thischip = NewChips[uuid] = {
            ChipName: chipd["ReadonlyChipName"],
            PaletteName: chipd["ReadonlyPaletteName"],
            Description: chipd["Description"],
            //custom here
            Model: "Default",
            //
            IsBeta: chipd["IsBetaChip"],
            TrollingRisk: chipd["IsTrollingRisk"],
            DeprecationStage: chipd["DeprecationStage"]
        }
        for(const NodeDesc of chipd["NodeDescs"]){
            const TempPortAssign = {}
            if(Object.keys(NodeDesc["ReadonlyTypeParams"]).length > 0){
                for(let [ParamKey, ParamValue] of Object.entries(NodeDesc["ReadonlyTypeParams"])) {
                    ParamValue = ParamValue.toLowerCase().replace("(", "").replace(")", "").split(" | ")
                    if(ParamValue.length < 2) {
                        TempPortAssign[ParamKey] = ParamValue[0]
                    } else TempPortAssign[ParamKey] = ParamValue;
                }
            }
            for(const port of NodeDesc["Inputs"]) {
                let IsList;
                let IsUnion;
                if(port["ReadonlyType"].includes("List<")) {
                    port["ReadonlyType"] = port["ReadonlyType"].replace("List<", "").replace(">", "")
                    IsList = true
                } else IsList = false;
                if(TempPortAssign[port["ReadonlyType"]] !== undefined) {
                    if(typeof(TempPortAssign[port["ReadonlyType"]]) == "string") {
                        IsUnion = false
                    } else {
                        IsUnion = true
                    }

                    port["ReadonlyType"] = TempPortAssign[port["ReadonlyType"]]
                    
                } else {
                    port["ReadonlyType"] = port["ReadonlyType"].toLowerCase()
                    IsUnion = false
                }
                port["DataType"] = port["ReadonlyType"]
                port["IsUnion"] = IsUnion
                port["IsList"] = IsList
                delete port["ReadonlyType"]
            }
            for(const port of NodeDesc["Outputs"]) {
                let IsList;
                let IsUnion;
                if(port["ReadonlyType"].includes("List<")) {
                    port["ReadonlyType"] = port["ReadonlyType"].replace("List<", "").replace(">", "")
                    IsList = true
                } else IsList = false;
                if(TempPortAssign[port["ReadonlyType"]] !== undefined) {
                    if(typeof(TempPortAssign[port["ReadonlyType"]]) == "string") {
                        IsUnion = false
                    } else {
                        IsUnion = true
                    }

                    port["ReadonlyType"] = TempPortAssign[port["ReadonlyType"]]
                    
                } else {
                    port["ReadonlyType"] = port["ReadonlyType"].toLowerCase()
                    IsUnion = false
                }
                port["DataType"] = port["ReadonlyType"]
                port["IsUnion"] = IsUnion
                port["IsList"] = IsList
                delete port["ReadonlyType"]
            }
            delete NodeDesc["ReadonlyTypeParams"]
        }
        thischip["Functions"] = chipd["NodeDescs"]
    }
}
function RestOfUpdate(){
    oldJSON_raw = fs.readFileSync(DownloadFile, "utf-8")
    OldJSON = JSON.parse(oldJSON_raw)["Nodes"]
    OldJSON_Clone = JSON.parse(oldJSON_raw)["Nodes"]
    entries = Object.entries(OldJSON_Clone)
    
    AddStep("Updating ports.json...")
    RetrievePorts();
    fs.writeFileSync("Generated/ports.json", JSON.stringify(PortTypes, null, 4))

    AddStep("Translating chips...")
    TranslateChipData();
    fs.writeFileSync("Generated/chips.json", JSON.stringify(NewChips, null, 4))

    AddStep("Generating info.txt...")
    fs.writeFileSync("Generated/info.txt", "Generated on " + new Date(Date.now()).toDateString())

    AddStep("Preparing page files...")
    PrepareFiles();

    AddStep("TEMP: Generating test SVG")
    fs.writeFileSync("Generated/TestSVG.svg", SVGGen.Generate("7e321d9b-4500-4917-9361-a32e1463401c"))

    console.log("Finished!")
    exit(0)
}
AddStep("Downloading chips...")
fs.mkdirSync("Generated", {recursive: true}, function (err){
    if (err) console.log("error");
})
const file = fs.createWriteStream("Generated/Chips_OLD.json");
const request = https.get("https://raw.githubusercontent.com/tyleo-rec/CircuitsV2Resources/master/misc/circuitsv2.json", function(response) {
    response.pipe(file);

    file.on("finish", () => {
        file.close()
        RestOfUpdate()
    })
})

/*
Script made by Funn Punn. Please don't modify this, I already have a hard time reading my own code.
Thanks!

^•ﻌ•^
*/
