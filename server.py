import json
import os
import csv
import base64
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DIR_BASE = os.path.dirname(os.path.abspath(__file__))
PASTA_FOTOS = os.path.join(DIR_BASE, 'fotos')
PASTA_DATA = os.path.join(DIR_BASE, 'data')
PORT = 8000  # no servidor da empresa será 5002

# ================== USUÁRIOS ==================
APR = {'email': 'apr4@conebel.com.br', 'senha': 'conebel2026', 'nome': 'Administrador', 'perfil': 'APR', 'sala': None}
GVS = [
    {'email': 'marcosgasparine@conebel.com.br', 'senha': 'conebel2026', 'nome': 'Marcos',  'perfil': 'GV', 'sala': 'Marcos'},
    {'email': 'ulissesazevedo@conebel.com.br',  'senha': 'conebel2026', 'nome': 'Ulisses', 'perfil': 'GV', 'sala': 'Ulisses'},
    {'email': 'anisio@conebel.com.br',          'senha': 'conebel2026', 'nome': 'Junior',  'perfil': 'GV', 'sala': 'Junior'},
]
# RNs: e-mail rn<codigo>@conebel.com.br / senha 1234
SETORES_RN = [str(s) for s in list(range(101, 112)) + list(range(201, 207)) + list(range(301, 309))]
SETORES_RN.remove('206')
RNs = [{'email': 'conebel.rn' + s + '@gmail.com', 'senha': 'cone2677', 'nome': 'RN ' + s,
        'perfil': 'RN', 'setor': s} for s in SETORES_RN]

# ================== E-MAIL (SMTP Outlook) ==================
SMTP_HOST = 'smtp.office365.com'
SMTP_PORT = 587
SMTP_EMAIL = 'apr4@conebel.com.br'
SMTP_SENHA = 'wvsczlwynrlyfmvy'   # senha do e-mail ou senha de app (ver item 2)

os.makedirs(PASTA_FOTOS, exist_ok=True)

# ================== PACOTE DE DADOS PARA O APP ==================
def ler_csv(nome):
    caminho = os.path.join(PASTA_DATA, nome)
    if not os.path.exists(caminho):
        return []
    with open(caminho, encoding='utf-8-sig') as f:
        primeira = f.readline()
        f.seek(0)
        # Excel pt-BR exporta com ';'; detecta o separador automaticamente
        sep = ';' if primeira.count(';') > primeira.count(',') else ','
        return list(csv.DictReader(f, delimiter=sep))

def fotos_base64():
    fotos = {}
    if not os.path.exists(PASTA_FOTOS):
        return fotos
    for nome in os.listdir(PASTA_FOTOS):
        if nome.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
            cod = os.path.splitext(nome)[0]
            ext = os.path.splitext(nome)[1].lower().replace('.', '')
            with open(os.path.join(PASTA_FOTOS, nome), 'rb') as f:
                dados = base64.b64encode(f.read()).decode('ascii')
            fotos[cod] = 'data:image/' + ext + ';base64,' + dados
    return fotos

def gerar_pacote(setor):
    setor = str(setor)
    base = [b for b in ler_csv('base.csv') if str(b.get('RN', '')).strip() == setor]
    vendas = [v for v in ler_csv('vendas.csv') if str(v.get('Setor_cl', '')).strip() == setor]
    return {
        'rn': setor,
        'gerado_em': datetime.now().strftime('%d/%m/%Y %H:%M'),
        'base': base,
        'produtos': ler_csv('produtos.csv'),
        'vendas': vendas,
        'fotos': fotos_base64()
    }

def enviar_email_rn(rn_user):
    pacote = gerar_pacote(rn_user['setor'])
    corpo_json = json.dumps(pacote, ensure_ascii=False)
    msg = MIMEMultipart()
    msg['From'] = SMTP_EMAIL
    msg['To'] = rn_user['email']
    msg['Subject'] = ('Conebel App - Dados do setor ' + rn_user['setor'] +
                      ' (' + datetime.now().strftime('%d/%m/%Y') + ')')
    msg.attach(MIMEText(
        'Segue o arquivo com os dados do seu setor para importar no aplicativo Conebel.\n\n'
        'Gerado em: ' + pacote['gerado_em'] + '\n\n'
        'No app: aba Dados > Importar Manual > selecione o arquivo baixado do e-mail.',
        'plain', 'utf-8'))
    anexo = MIMEApplication(corpo_json.encode('utf-8'), _subtype='json')
    anexo.add_header('Content-Disposition', 'attachment',
                     filename='dados_rn' + rn_user['setor'] + '.json')
    msg.attach(anexo)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(SMTP_EMAIL, SMTP_SENHA)
        s.send_message(msg)

class Handler(SimpleHTTPRequestHandler):
    # Arquivos que NUNCA podem ser acessados pelo navegador
    ARQUIVOS_BLOQUEADOS = ('/server.py', '/.well-known/')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR_BASE, **kwargs)

    def _bloqueado(self, caminho):
        for prefixo in self.ARQUIVOS_BLOQUEADOS:
            if caminho.startswith(prefixo):
                return True
        return False

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _ler_corpo(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length else b''

    def do_POST(self):
        caminho = urlparse(self.path).path
        if caminho == '/login':
            try:
                corpo = json.loads(self._ler_corpo().decode('utf-8'))
                perfil = corpo.get('perfil', '')
                email = str(corpo.get('email', '')).strip().lower()
                senha = str(corpo.get('senha', ''))
                if perfil == 'APR':
                    if email == APR['email'] and senha == APR['senha']:
                        self._send_json({'ok': True, 'usuario': {
                            'perfil': 'APR', 'nome': APR['nome'], 'sala': None}})
                        return
                elif perfil == 'GV':
                    for u in GVS:
                        if email == u['email'] and senha == u['senha']:
                            self._send_json({'ok': True, 'usuario': {
                                'perfil': 'GV', 'nome': u['nome'], 'sala': u['sala']}})
                            return
                elif perfil == 'RN':
                    for u in RNs:
                        if email == u['email'] and senha == u['senha']:
                            self._send_json({'ok': True, 'usuario': {
                                'perfil': 'RN', 'nome': u['nome'], 'setor': u['setor']}})
                            return
                self._send_json({'ok': False, 'erro': 'E-mail ou senha inválidos'}, 401)
            except Exception as e:
                self._send_json({'ok': False, 'erro': str(e)}, 500)
            return
        if caminho == '/upload':
            try:
                corpo = json.loads(self._ler_corpo().decode('utf-8'))
                cod = str(corpo.get('cod', '')).strip()
                data = corpo.get('data', '')
                if not cod or not data:
                    self._send_json({'ok': False, 'erro': 'cod e data são obrigatorios'}, 400)
                    return
                if ',' in data:
                    data = data.split(',', 1)[1]
                binario = base64.b64decode(data)
                nome = cod + '.png'
                with open(os.path.join(PASTA_FOTOS, nome), 'wb') as f:
                    f.write(binario)
                self._send_json({'ok': True, 'arquivo': 'fotos/' + nome})
            except Exception as e:
                self._send_json({'ok': False, 'erro': str(e)}, 500)
            return
        if caminho == '/delete':
            try:
                corpo = json.loads(self._ler_corpo().decode('utf-8'))
                cod = str(corpo.get('cod', '')).strip()
                caminho_arquivo = os.path.join(PASTA_FOTOS, cod + '.png')
                if os.path.exists(caminho_arquivo):
                    os.remove(caminho_arquivo)
                self._send_json({'ok': True})
            except Exception as e:
                self._send_json({'ok': False, 'erro': str(e)}, 500)
            return
        if caminho == '/enviar-email':
            try:
                corpo = json.loads(self._ler_corpo().decode('utf-8'))
                if str(corpo.get('senha_apr', '')) != APR['senha']:
                    self._send_json({'ok': False, 'erro': 'Senha do APR incorreta'}, 401)
                    return
                selecionados = corpo.get('rns', [])
                enviados, erros = [], []
                for setor in selecionados:
                    user = next((u for u in RNs if u['setor'] == str(setor)), None)
                    if not user:
                        erros.append(str(setor) + ': RN não encontrado')
                        continue
                    try:
                        enviar_email_rn(user)
                        enviados.append(str(setor))
                    except Exception as e:
                        erros.append(str(setor) + ': ' + str(e))
                self._send_json({'ok': True, 'enviados': enviados, 'erros': erros})
            except Exception as e:
                self._send_json({'ok': False, 'erro': str(e)}, 500)
            return
        self._send_json({'ok': False, 'erro': 'rota nao encontrada'}, 404)

    def do_GET(self):
        caminho = urlparse(self.path).path
        if self._bloqueado(caminho):
            self.send_error(404)
            return
        if caminho == '/fotos':
            fotos = {}
            for nome in os.listdir(PASTA_FOTOS):
                if nome.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                    cod = os.path.splitext(nome)[0]
                    fotos[cod] = 'fotos/' + nome
            self._send_json({'ok': True, 'fotos': fotos})
            return
        if caminho == '/pacote':
            qs = parse_qs(urlparse(self.path).query)
            email = (qs.get('email', [''])[0]).strip().lower()
            senha = qs.get('senha', [''])[0]
            user = next((u for u in RNs if email == u['email'] and senha == u['senha']), None)
            if not user:
                self._send_json({'ok': False, 'erro': 'Credenciais inválidas'}, 401)
                return
            self._send_json({'ok': True, 'pacote': gerar_pacote(user['setor'])})
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

if __name__ == '__main__':
    print('Servidor rodando em http://localhost:' + str(PORT))
    ThreadingHTTPServer(('', PORT), Handler).serve_forever()
