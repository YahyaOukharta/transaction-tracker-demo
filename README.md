# Transaction tracker

## Steps to run:
- [ ] `pip install -r ./requirements.txt`

- [ ] `cd deploy; docker compose  -f docker-compose-local.yaml up --build`

- [ ] `cd .. ; python manage.py migrate`

- [ ] Visit [http://localhost:8000](http://localhost:8000)