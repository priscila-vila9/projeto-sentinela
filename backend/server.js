const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

// LER BANCO DE DADOS
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [],
      tv_chamada: null,
      tv_historico: []
    };
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

  if (!Array.isArray(db.usuarios)) db.usuarios = [];
  if (!Array.isArray(db.pacientes)) db.pacientes = [];
  if (!Array.isArray(db.triagens)) db.triagens = [];
  if (!Array.isArray(db.consultas)) db.consultas = [];
  if (!Array.isArray(db.tv_historico)) db.tv_historico = [];

  if (db.tv_chamada === undefined) {
    db.tv_chamada = null;
  }

  return db;
}

// SALVAR BANCO DE DADOS
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// LOGIN
app.post("/login", (req, res) => {
  try {
    const db = readDB();

    const usuario = String(req.body.usuario || "").trim();
    const senha = String(req.body.senha || "");

    const user = db.usuarios.find(u =>
      u.usuario === usuario && u.senha === senha
    );

    if (!user) {
      return res.status(401).json({
        erro: "Login inválido."
      });
    }

    // Não enviar a senha para o navegador
    res.json({
      usuario: user.usuario,
      tipo: user.tipo
    });

  } catch (erro) {
    console.error("Erro no login:", erro);

    res.status(500).json({
      erro: "Erro interno ao realizar login."
    });
  }
});

// CADASTRAR USUÁRIO
app.post("/usuarios", (req, res) => {
  try {
    const db = readDB();

    const usuario = String(req.body.usuario || "").trim();
    const senha = String(req.body.senha || "");
    const tipo = String(req.body.tipo || "").trim();

    const tiposPermitidos = [
      "admin",
      "atendimento",
      "triagem",
      "medico",
      "medicacoes"
    ];

    if (!usuario || !senha || !tipo) {
      return res.status(400).json({
        erro: "Preencha todos os campos."
      });
    }

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        erro: "Selecione um setor válido."
      });
    }

    const existe = db.usuarios.some(
      u => u.usuario.toLowerCase() === usuario.toLowerCase()
    );

    if (existe) {
      return res.status(400).json({
        erro: "Este usuário já está cadastrado."
      });
    }

    const novoUsuario = {
      usuario,
      senha,
      tipo
    };

    db.usuarios.push(novoUsuario);
    writeDB(db);

    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso!",
      usuario: {
        usuario: novoUsuario.usuario,
        tipo: novoUsuario.tipo
      }
    });

  } catch (erro) {
    console.error("Erro ao cadastrar usuário:", erro);

    res.status(500).json({
      erro: "Não foi possível cadastrar o usuário."
    });
  }
});

// LISTAR USUÁRIOS
app.get("/usuarios", (req, res) => {
  try {
    const db = readDB();

    // Nunca enviar as senhas na listagem
    const usuarios = db.usuarios.map(u => ({
      usuario: u.usuario,
      tipo: u.tipo
    }));

    res.json(usuarios);

  } catch (erro) {
    console.error("Erro ao listar usuários:", erro);

    res.status(500).json({
      erro: "Não foi possível carregar os usuários."
    });
  }
});

// ATENDIMENTO - CADASTRAR PACIENTE
app.post("/atendimento", (req, res) => {
  try {
    const db = readDB();

    const paciente = {
      id: Date.now(),
      nome: req.body.nome,
      cpf: req.body.cpf,
      tipo: req.body.tipo,
      status: "triagem",
      createdAt: new Date()
    };

    db.pacientes.push(paciente);
    writeDB(db);

    res.status(201).json(paciente);

  } catch (erro) {
    console.error("Erro ao cadastrar paciente:", erro);

    res.status(500).json({
      erro: "Não foi possível cadastrar o paciente."
    });
  }
});

// LISTAR PACIENTES
app.get("/pacientes", (req, res) => {
  try {
    res.json(readDB().pacientes);
  } catch (erro) {
    res.status(500).json({
      erro: "Não foi possível carregar os pacientes."
    });
  }
});

// TRIAGEM
app.post("/triagem", (req, res) => {
  try {
    const db = readDB();

    let risco = req.body.risco;
    const temperatura = Number(req.body.temperatura);

    if (Number.isFinite(temperatura) && temperatura >= 39) {
      risco = "vermelho";
    } else if (Number.isFinite(temperatura) && temperatura >= 38) {
      risco = "amarelo";
    } else if (!risco) {
      risco = "verde";
    }

    const triagem = {
      id: Date.now(),
      nome: req.body.nome,
      sintoma: req.body.sintoma,
      temperatura: req.body.temperatura,
      alergia: req.body.alergia,
      observacao: req.body.observacao,
      risco,
      status: "aguardando_medico",
      createdAt: new Date()
    };

    db.triagens.push(triagem);
    writeDB(db);

    res.status(201).json(triagem);

  } catch (erro) {
    console.error("Erro na triagem:", erro);

    res.status(500).json({
      erro: "Não foi possível salvar a triagem."
    });
  }
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  try {
    res.json(readDB().triagens);
  } catch (erro) {
    res.status(500).json({
      erro: "Não foi possível carregar as triagens."
    });
  }
});

// TV - CHAMAR PACIENTE
app.post("/tv/chamar", (req, res) => {
  try {
    const db = readDB();

    const chamada = {
      id: Date.now().toString(),
      localTipo: req.body.localTipo,
      localNumero: req.body.localNumero,
      paciente: req.body.paciente,
      hora: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    db.tv_chamada = chamada;
    db.tv_historico.unshift(chamada);

    if (db.tv_historico.length > 5) {
      db.tv_historico.pop();
    }

    writeDB(db);

    res.json(chamada);

  } catch (erro) {
    console.error("Erro na chamada:", erro);

    res.status(500).json({
      erro: "Não foi possível realizar a chamada."
    });
  }
});

// TV - CONSULTAR CHAMADA E HISTÓRICO
app.get("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    res.json({
      chamada: db.tv_chamada,
      historico: db.tv_historico
    });

  } catch (erro) {
    res.status(500).json({
      erro: "Não foi possível carregar as chamadas."
    });
  }
});

// LISTA DE MEDICAÇÕES DISPONÍVEIS
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// CONSULTA - SALVAR DIAGNÓSTICO E MEDICAÇÃO
app.post("/consulta", (req, res) => {
  try {
    const db = readDB();

    const consulta = {
      id: Date.now(),
      paciente: req.body.paciente,
      diagnostico: req.body.diagnostico,
      medicacao: req.body.medicacao || "",
      obs: req.body.obs || "",
      createdAt: new Date()
    };

    db.consultas.push(consulta);
    writeDB(db);

    res.status(201).json(consulta);

  } catch (erro) {
    console.error("Erro ao salvar consulta:", erro);

    res.status(500).json({
      erro: "Não foi possível salvar a consulta."
    });
  }
});

// MEDICAÇÕES PRESCRITAS
app.get("/medicacoes", (req, res) => {
  try {
    const db = readDB();

    const medicacoes = db.consultas.filter(consulta =>
      typeof consulta.medicacao === "string"
        ? consulta.medicacao.trim() !== ""
        : Boolean(consulta.medicacao)
    );

    res.json(medicacoes);

  } catch (erro) {
    console.error("Erro ao carregar medicações:", erro);

    res.status(500).json({
      erro: "Não foi possível carregar as medicações."
    });
  }
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
