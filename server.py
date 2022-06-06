#!/usr/bin/env python
# -*- coding:utf-8 -*-
import json
from flask import Flask,render_template, request, send_from_directory,jsonify
from flask_cors import cross_origin
from cqparts import Assembly

import os
# import sys
# reload(sys)
# sys.setdefaultencoding('utf-8')
app = Flask(__name__,static_folder='upload')

# ALLOWED_EXTENSTIONS = set(['png', 'jpg', 'jpeg', 'gif'])
app.config['UPLOAD_FOLDER'] = os.getcwd()
 
download_floder = app.config['UPLOAD_FOLDER'] + '/upload'

print(download_floder)

def allow_file(filename):
    allow_list = ['STEP'] 
    a = filename.split('.')[1]
    if a in allow_list:
        return True
    else:
        return False

@app.route('/getlist')
def getlist():
    file_url_list = []
    file_floder = app.config['UPLOAD_FOLDER'] + '/upload'
    file_list = os.listdir(file_floder)
    for filename in file_list:
        file_url = url_for('download',filename=filename)
        file_url_list.append(file_url)
    # print file_list
    return jsonify(file_list)

@app.route('/download/<filename>')
@cross_origin()
def download(filename):
    return send_from_directory(download_floder,filename, as_attachment=True)

@app.route('/upload', methods=['POST', 'GET'])
@cross_origin()
def upload():
    file = request.files['file']
    print(file.__dict__)
    if not file:
        return render_template('index.html', status='null')
    # print type(file)
    if allow_file(file.filename):
        dirpath=app.config['UPLOAD_FOLDER']+'/upload/'
        filePath=os.path.join(dirpath, file.filename)
        file.save(filePath)
        newFilePath=os.path.join(dirpath,file.filename.replace('STEP','gltf'))
        
        Assembly.importer('step')(filePath).exporter('gltf')(filename=newFilePath, embed=False)

        res_json = json.dumps({
            "ok":True,
            "url":file.filename.replace('STEP','gltf')
        })
        return res_json
    else:
        return 'NO'

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')