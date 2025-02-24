import glob
import os
import json

cwd = os.getcwd()

def createKey(dict, key):
    if key not in dict:
        dict[key] = {}

def findSubDict(inDict, keys, i):
    outDict = inDict
    for j in range(i):
        outDict = outDict[keys[j]]
    return outDict

def getDictionaryFromJson(jsonFilePath):
    with open(jsonFilePath, 'r', encoding='utf-8') as file:
        return json.load(file)
  
class CaseHandler:
    def camelToPascalSnake(string):
        returnString = ''.join(['_' + c.upper() if c.isupper() else c for c in string]).lstrip('_')
        if len(returnString) > 1:
            return returnString[0].upper() + returnString[1:]
        return returnString.upper()

    def camelToMacro(string):
        return ''.join(['_' + c if c.isupper() else c for c in string]).lstrip('_').upper()

    def camelToSnake(string):
        return ''.join(['_' + c.lower() if c.isupper() else c for c in string]).lstrip('_')
    
    def snakeOrMacroToCamel(string):
        words = string.split('_')
        return ''.join([c.title() if words.index(c) != 0 else c.lower() for c in words])

outDict = {}

filePaths = glob.glob(os.path.join(cwd, 'src/**/*.dict.json'), recursive=True)

print(outDict)

for filePath in filePaths:
    filePath = filePath.replace('\\', '/')
    relativePath = filePath.split('src/')[1]
    pathParts = relativePath.split('/')

    for i in range(len(pathParts)):
        if i == len(pathParts) - 1:
            # convert casing of file names
            pathParts[i] = CaseHandler.camelToMacro(pathParts[i].split('.dict.json')[0])
            pathPart = pathParts[i]

            subDict = findSubDict(outDict, pathParts, i)
            createKey(subDict, pathPart)
            subDict[pathPart] = getDictionaryFromJson(filePath)
        
        else:
            # convert casing of folder names
            pathParts[i] = CaseHandler.camelToPascalSnake(pathParts[i])
            pathPart = pathParts[i]

            subDict = findSubDict(outDict, pathParts, i)
            createKey(subDict, pathPart)

print("\n",outDict)
print("\n",json.dumps(outDict, indent=2))
print("\n", outDict.keys())