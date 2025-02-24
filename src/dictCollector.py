import glob
import os

cwd = os.getcwd()

files = glob.glob(os.path.join(cwd, 'src/**/*.dict.json'), recursive=True)
print('\nNamed with recursive=True:')
for name in files:
    print(name)
    