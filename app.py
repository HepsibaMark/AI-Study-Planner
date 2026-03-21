from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/subjects', methods=['POST'])
def subjects():
    num = int(request.form['num_subjects'])
    return render_template('subjects.html', num=num)

@app.route('/result', methods=['POST'])
def result():
    subjects = request.form.getlist('subject')
    difficulty = request.form.getlist('difficulty')
    hours = request.form.getlist('hours')

    plan = []

    for i in range(len(subjects)):
        plan.append({
            "subject": subjects[i],
            "difficulty": difficulty[i],
            "hours": hours[i]
        })

    return render_template('result.html', plan=plan)

if __name__ == "__main__":
    app.run(debug=True)