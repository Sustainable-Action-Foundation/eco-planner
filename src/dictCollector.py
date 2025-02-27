import glob
import os
import json

cwd = os.getcwd()
collectedDictionaryPath = os.path.join(cwd, 'src', 'collectedDictionary.json')

def getDictionaryFromJson(jsonFilePath):
    with open(jsonFilePath, 'r', encoding='utf-8') as file:
        return json.load(file)

def saveDictAsJson(pyDict, jsonFilePath):
    with open(jsonFilePath, 'w', encoding='utf-8') as file:
        json.dump(pyDict, file, indent=2, ensure_ascii=False)
  
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
        words[0] = words[0].lower()
        for i in range(1, len(words)):
            words[i] = words[i].capitalize()
        return ''.join(words)
        return ''.join([c.capitalize() if words.index(c) != 0 else c.lower() for c in words])

def generateCollectedDictionary():
    def createKey(dict, key):
        if key not in dict:
            dict[key] = {}

    def findSubDict(inDict, keys, i):
        outDict = inDict
        for j in range(i):
            outDict = outDict[keys[j]]
        return outDict

    outDict = {}

    filePaths = glob.glob(os.path.join(cwd, 'src','**','*.dict.json'), recursive=True)

    for filePath in filePaths:
        # filePath = filePath.replace('\\', '/')
        relativePath = filePath.split('src\\')[1]
        pathParts = relativePath.split('\\')

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

    saveDictAsJson(outDict, os.path.join(cwd, 'src', 'collectedDictionary.json'))

def unpackCollectedDictionary():
    collectedDictionary = getDictionaryFromJson(collectedDictionaryPath)

    def findSubDict(inDict, keys, i):
        outDict = inDict
        for j in range(i):
            outDict = outDict[keys[j]]
        return outDict

    def findSubDictPaths(inDict):
        def findSubDictPathsRecursively(inDict):
            paths = []
            for key in inDict:
                if type(inDict[key]) is dict and not key[0].islower():
                    subPaths = findSubDictPathsRecursively(inDict[key])
                    for subPath in subPaths:
                        paths.append(os.path.join(key, subPath))
                else:
                    if not key in paths:
                      paths.append(key)

            return paths
        
        returnSubDictPaths = findSubDictPathsRecursively(inDict)
        for i in range(len(returnSubDictPaths)):
            splitPath = returnSubDictPaths[i].split('\\')
            returnSubDictPaths[i] = '\\'.join(splitPath[:len(splitPath)-1])

        returnSubDictPaths = sorted(set(returnSubDictPaths))
          
        return returnSubDictPaths
    
    subDictPaths = findSubDictPaths(collectedDictionary)

    for filePath in subDictPaths:
        pathParts = filePath.split('\\')
        filePath = os.path.join(cwd, 'src')

        for pathPart in pathParts:
            filePath = os.path.join(filePath, pathPart)

        relativePath = filePath.split('src\\')[1]
        pathParts = relativePath.split('\\')
        
        for i in range(len(pathParts)):
            
            if i == len(pathParts) - 1:
                
                subdict = findSubDict(collectedDictionary, pathParts, i+1)

                for j in range(len(pathParts)):
                    pathParts[j] = CaseHandler.snakeOrMacroToCamel(pathParts[j])

                joinedPathParts = '\\'.join(pathParts)
                filePath = os.path.join(cwd, 'src', joinedPathParts+".dict.json")

                print(filePath)
                saveDictAsJson(subdict, filePath)

generateCollectedDictionary()
unpackCollectedDictionary()
