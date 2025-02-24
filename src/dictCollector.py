import glob
import os

cwd = os.getcwd()

def createKey(dict, key):
    # print(dict, key)
    if key not in dict:
        # print("key not found in dict")
        dict[key] = {}

def findSubDict(dict, keys, i):
    returnDict = dict
    for j in range(i):
        returnDict = returnDict[keys[j]]
    # print("\nreturnDict:",returnDict)
    return returnDict

outDict = {}

filePaths = glob.glob(os.path.join(cwd, 'src/**/*.dict.json'), recursive=True)

print(outDict)

for filePath in filePaths:
    # print(filePath)
    filePath = filePath.replace('\\', '/')
    relativePath = filePath.split('src/')[1]
    pathParts = relativePath.split('/')
    for i in range(len(pathParts)):
        pathPart = pathParts[i]
        if i == len(pathParts) - 1:
            dict = findSubDict(outDict, pathParts, i)
            fileName = pathPart.split('.dict.json')[0]
            createKey(dict, fileName)
            dict = dict[fileName]
            print("\n", dict, pathPart)
            continue
        elif i == 0:
            createKey(outDict, pathPart)
        else:
            # dict = outDict
            # for j in range(i):
            #     dict = dict[pathParts[j]]
            dict = findSubDict(outDict, pathParts, i)
            createKey(dict, pathPart)
            
        # if i == len(pathParts) - 1:
        #     tryAdd(outDict, pathPart, filePath)
        # else:
        #     if pathPart not in outDict:
        #         outDict[pathPart] = {}
        #     outDict = outDict[pathPart]

    # print(relativePath)
    # tryAdd(outDict, relativePath, filePath)


print("\n",outDict)