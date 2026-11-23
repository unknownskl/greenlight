/**
 * The words of the interface of games: the names of the things every menu has (pause, settings, inventory, resume,
 * quit ...) in the languages the text can be read in. They are used for two things:
 *  - a screen that has several of them is a menu, even when only a few lines of text were found (see AutoWindows);
 *  - a label that is exactly such a word is translated from a list (a machine translation is often wrong on one word
 *    out of context: "PAUSED" has come out as nonsense).
 */

interface Concept {
    id: string;
    // The words and phrases of the concept in each language (lower case)
    words: Record<string, string[]>;
    // The translation of the English wording (what the label of a game says), when there is one worth fixing
    uk?: string;
    ru?: string;
}

const CONCEPTS: Concept[] = [
    { id: 'pause', uk: 'Пауза', ru: 'Пауза', words: { en: ['pause', 'paused', 'game paused'], de: ['pause', 'pausiert'], fr: ['pause', 'en pause'], es: ['pausa', 'en pausa'], it: ['pausa', 'in pausa'], pt: ['pausa', 'pausado'], pl: ['pauza', 'wstrzymano'], ru: ['пауза'], uk: ['пауза'] } },
    { id: 'resume', uk: 'Продовжити', ru: 'Продолжить', words: { en: ['resume', 'continue'], de: ['fortsetzen', 'weiter', 'spiel fortsetzen'], fr: ['reprendre', 'continuer'], es: ['reanudar', 'continuar'], it: ['riprendi', 'continua'], pt: ['retomar', 'continuar'], pl: ['wznów', 'kontynuuj'], ru: ['продолжить'], uk: ['продовжити'] } },
    { id: 'settings', uk: 'Налаштування', ru: 'Настройки', words: { en: ['settings', 'options', 'preferences', 'configuration'], de: ['einstellungen', 'optionen'], fr: ['paramètres', 'options', 'réglages'], es: ['ajustes', 'opciones', 'configuración'], it: ['impostazioni', 'opzioni'], pt: ['configurações', 'opções'], pl: ['ustawienia', 'opcje'], ru: ['настройки', 'параметры'], uk: ['налаштування', 'параметри'] } },
    { id: 'inventory', uk: 'Інвентар', ru: 'Инвентарь', words: { en: ['inventory'], de: ['inventar'], fr: ['inventaire'], es: ['inventario'], it: ['inventario'], pt: ['inventário'], pl: ['ekwipunek', 'inwentarz'], ru: ['инвентарь'], uk: ['інвентар'] } },
    { id: 'quit', uk: 'Вийти', ru: 'Выйти', words: { en: ['quit', 'exit'], de: ['beenden', 'verlassen', 'spiel beenden'], fr: ['quitter'], es: ['salir'], it: ['esci'], pt: ['sair'], pl: ['wyjdź', 'wyjście'], ru: ['выйти', 'выход'], uk: ['вийти', 'вихід'] } },
    { id: 'mainmenu', uk: 'Вийти в меню', ru: 'Выйти в меню', words: { en: ['quit to menu', 'exit to menu', 'return to menu', 'main menu'], de: ['zum hauptmenü', 'hauptmenü'], fr: ['menu principal', 'retour au menu'], es: ['menú principal', 'salir al menú'], it: ['menu principale', 'esci al menu'], pt: ['menu principal', 'sair para o menu'], pl: ['menu główne', 'wyjdź do menu'], ru: ['главное меню', 'выйти в меню'], uk: ['головне меню', 'вийти в меню'] } },
    { id: 'back', uk: 'Назад', ru: 'Назад', words: { en: ['back', 'go back'], de: ['zurück'], fr: ['retour'], es: ['atrás', 'volver'], it: ['indietro'], pt: ['voltar'], pl: ['wstecz', 'wróć'], ru: ['назад'], uk: ['назад'] } },
    { id: 'save', uk: 'Зберегти', ru: 'Сохранить', words: { en: ['save'], de: ['speichern'], fr: ['sauvegarder', 'enregistrer'], es: ['guardar'], it: ['salva'], pt: ['salvar', 'guardar'], pl: ['zapisz'], ru: ['сохранить'], uk: ['зберегти'] } },
    { id: 'load', uk: 'Завантажити', ru: 'Загрузить', words: { en: ['load'], de: ['laden', 'spiel laden'], fr: ['charger'], es: ['cargar'], it: ['carica'], pt: ['carregar'], pl: ['wczytaj'], ru: ['загрузить'], uk: ['завантажити'] } },
    { id: 'newgame', uk: 'Нова гра', ru: 'Новая игра', words: { en: ['new game'], de: ['neues spiel'], fr: ['nouvelle partie'], es: ['nueva partida', 'nuevo juego'], it: ['nuova partita'], pt: ['novo jogo'], pl: ['nowa gra'], ru: ['новая игра'], uk: ['нова гра'] } },
    { id: 'map', uk: 'Карта', ru: 'Карта', words: { en: ['map'], de: ['karte'], fr: ['carte'], es: ['mapa'], it: ['mappa'], pt: ['mapa'], pl: ['mapa'], ru: ['карта'], uk: ['карта'] } },
    { id: 'quests', uk: 'Завдання', ru: 'Задания', words: { en: ['quests', 'quest', 'missions', 'objectives', 'tasks'], de: ['aufgaben', 'missionen', 'quests'], fr: ['quêtes', 'missions', 'objectifs'], es: ['misiones', 'objetivos'], it: ['missioni', 'obiettivi'], pt: ['missões', 'objetivos'], pl: ['zadania', 'misje', 'cele'], ru: ['задания', 'миссии', 'цели'], uk: ['завдання', 'місії', 'цілі'] } },
    { id: 'journal', uk: 'Журнал', ru: 'Журнал', words: { en: ['journal', 'log'], de: ['tagebuch'], fr: ['journal'], es: ['diario'], it: ['diario'], pt: ['diário'], pl: ['dziennik'], ru: ['журнал'], uk: ['журнал'] } },
    { id: 'controls', uk: 'Керування', ru: 'Управление', words: { en: ['controls', 'controller', 'key bindings'], de: ['steuerung'], fr: ['commandes', 'contrôles'], es: ['controles'], it: ['comandi', 'controlli'], pt: ['controles', 'controlos'], pl: ['sterowanie'], ru: ['управление'], uk: ['керування'] } },
    { id: 'audio', uk: 'Звук', ru: 'Звук', words: { en: ['audio', 'sound', 'volume'], de: ['ton', 'audio', 'lautstärke'], fr: ['audio', 'son', 'volume'], es: ['audio', 'sonido', 'volumen'], it: ['audio', 'suono', 'volume'], pt: ['áudio', 'som', 'volume'], pl: ['dźwięk', 'głośność'], ru: ['звук', 'громкость'], uk: ['звук', 'гучність'] } },
    { id: 'video', uk: 'Графіка', ru: 'Графика', words: { en: ['video', 'graphics', 'display'], de: ['grafik', 'anzeige', 'video'], fr: ['graphismes', 'affichage', 'vidéo'], es: ['gráficos', 'pantalla', 'vídeo'], it: ['grafica', 'schermo', 'video'], pt: ['gráficos', 'ecrã', 'vídeo'], pl: ['grafika', 'obraz', 'wideo'], ru: ['графика', 'экран', 'видео'], uk: ['графіка', 'екран', 'відео'] } },
    { id: 'language', uk: 'Мова', ru: 'Язык', words: { en: ['language'], de: ['sprache'], fr: ['langue'], es: ['idioma'], it: ['lingua'], pt: ['idioma'], pl: ['język'], ru: ['язык'], uk: ['мова'] } },
    { id: 'difficulty', uk: 'Складність', ru: 'Сложность', words: { en: ['difficulty'], de: ['schwierigkeit', 'schwierigkeitsgrad'], fr: ['difficulté'], es: ['dificultad'], it: ['difficoltà'], pt: ['dificuldade'], pl: ['poziom trudności', 'trudność'], ru: ['сложность'], uk: ['складність'] } },
    { id: 'credits', uk: 'Титри', ru: 'Титры', words: { en: ['credits'], de: ['mitwirkende', 'credits'], fr: ['crédits'], es: ['créditos'], it: ['crediti'], pt: ['créditos'], pl: ['twórcy', 'napisy końcowe'], ru: ['титры'], uk: ['титри'] } },
    { id: 'confirm', uk: 'Підтвердити', ru: 'Подтвердить', words: { en: ['confirm', 'accept'], de: ['bestätigen'], fr: ['confirmer'], es: ['confirmar'], it: ['conferma'], pt: ['confirmar'], pl: ['potwierdź'], ru: ['подтвердить'], uk: ['підтвердити'] } },
    { id: 'cancel', uk: 'Скасувати', ru: 'Отменить', words: { en: ['cancel'], de: ['abbrechen'], fr: ['annuler'], es: ['cancelar'], it: ['annulla'], pt: ['cancelar'], pl: ['anuluj'], ru: ['отменить', 'отмена'], uk: ['скасувати'] } },
    { id: 'select', uk: 'Вибрати', ru: 'Выбрать', words: { en: ['select', 'choose'], de: ['auswählen'], fr: ['sélectionner'], es: ['seleccionar'], it: ['seleziona'], pt: ['selecionar'], pl: ['wybierz'], ru: ['выбрать'], uk: ['вибрати'] } },
    { id: 'apply', uk: 'Застосувати', ru: 'Применить', words: { en: ['apply'], de: ['übernehmen'], fr: ['appliquer'], es: ['aplicar'], it: ['applica'], pt: ['aplicar'], pl: ['zastosuj'], ru: ['применить'], uk: ['застосувати'] } },
    { id: 'yes', uk: 'Так', ru: 'Да', words: { en: ['yes'], de: ['ja'], fr: ['oui'], es: ['sí'], it: ['sì'], pt: ['sim'], pl: ['tak'], ru: ['да'], uk: ['так'] } },
    { id: 'no', uk: 'Ні', ru: 'Нет', words: { en: ['no'], de: ['nein'], fr: ['non'], es: ['no'], it: ['no'], pt: ['não'], pl: ['nie'], ru: ['нет'], uk: ['ні'] } },
    { id: 'equipment', uk: 'Спорядження', ru: 'Снаряжение', words: { en: ['equipment', 'gear', 'loadout'], de: ['ausrüstung'], fr: ['équipement'], es: ['equipo', 'equipamiento'], it: ['equipaggiamento'], pt: ['equipamento'], pl: ['wyposażenie'], ru: ['снаряжение', 'экипировка'], uk: ['спорядження'] } },
    { id: 'skills', uk: 'Навички', ru: 'Навыки', words: { en: ['skills', 'abilities', 'perks', 'talents'], de: ['fähigkeiten', 'talente'], fr: ['compétences'], es: ['habilidades'], it: ['abilità'], pt: ['habilidades'], pl: ['umiejętności'], ru: ['навыки', 'умения'], uk: ['навички', 'вміння'] } },
    { id: 'upgrades', uk: 'Покращення', ru: 'Улучшения', words: { en: ['upgrades', 'upgrade'], de: ['verbesserungen', 'upgrades'], fr: ['améliorations'], es: ['mejoras'], it: ['potenziamenti'], pt: ['melhorias'], pl: ['ulepszenia'], ru: ['улучшения'], uk: ['покращення'] } },
    { id: 'items', uk: 'Предмети', ru: 'Предметы', words: { en: ['items', 'item'], de: ['gegenstände'], fr: ['objets'], es: ['objetos'], it: ['oggetti'], pt: ['itens'], pl: ['przedmioty'], ru: ['предметы'], uk: ['предмети'] } },
    { id: 'weapons', uk: 'Зброя', ru: 'Оружие', words: { en: ['weapons', 'weapon'], de: ['waffen'], fr: ['armes'], es: ['armas'], it: ['armi'], pt: ['armas'], pl: ['broń'], ru: ['оружие'], uk: ['зброя'] } },
    { id: 'character', uk: 'Персонаж', ru: 'Персонаж', words: { en: ['character', 'profile'], de: ['charakter', 'profil'], fr: ['personnage', 'profil'], es: ['personaje', 'perfil'], it: ['personaggio', 'profilo'], pt: ['personagem', 'perfil'], pl: ['postać', 'profil'], ru: ['персонаж', 'профиль'], uk: ['персонаж', 'профіль'] } },
    { id: 'shop', uk: 'Крамниця', ru: 'Магазин', words: { en: ['shop', 'store', 'vendor', 'trade'], de: ['laden', 'händler', 'handel'], fr: ['boutique', 'marchand'], es: ['tienda', 'comerciante'], it: ['negozio', 'mercante'], pt: ['loja', 'comerciante'], pl: ['sklep', 'handlarz'], ru: ['магазин', 'торговец'], uk: ['крамниця', 'магазин', 'торговець'] } },
    { id: 'crafting', uk: 'Крафт', ru: 'Крафт', words: { en: ['crafting', 'craft'], de: ['herstellung', 'handwerk'], fr: ['artisanat', 'fabrication'], es: ['fabricación', 'creación'], it: ['creazione', 'artigianato'], pt: ['criação', 'fabrico'], pl: ['wytwarzanie', 'rzemiosło'], ru: ['крафт', 'создание'], uk: ['крафт', 'створення'] } },
    { id: 'checkpoint', uk: 'Контрольна точка', ru: 'Контрольная точка', words: { en: ['checkpoint'], de: ['kontrollpunkt'], fr: ['point de contrôle'], es: ['punto de control'], it: ['checkpoint'], pt: ['ponto de controlo'], pl: ['punkt kontrolny'], ru: ['контрольная точка'], uk: ['контрольна точка'] } },
    { id: 'lastcheckpoint', uk: 'Останній КПП', ru: 'Последний КПП', words: { en: ['last checkpoint'], de: ['letzter kontrollpunkt'], fr: ['dernier point de contrôle'], es: ['último punto de control'], it: ['ultimo checkpoint'], pt: ['último ponto de controlo'], pl: ['ostatni punkt kontrolny'], ru: ['последняя контрольная точка'], uk: ['остання контрольна точка'] } },
    { id: 'achievements', uk: 'Досягнення', ru: 'Достижения', words: { en: ['achievements', 'trophies'], de: ['erfolge', 'trophäen'], fr: ['succès', 'trophées'], es: ['logros', 'trofeos'], it: ['obiettivi', 'trofei'], pt: ['conquistas', 'troféus'], pl: ['osiągnięcia', 'trofea'], ru: ['достижения'], uk: ['досягнення'] } },
    { id: 'stats', uk: 'Статистика', ru: 'Статистика', words: { en: ['stats', 'statistics'], de: ['statistiken'], fr: ['statistiques'], es: ['estadísticas'], it: ['statistiche'], pt: ['estatísticas'], pl: ['statystyki'], ru: ['статистика'], uk: ['статистика'] } },
    { id: 'help', uk: 'Довідка', ru: 'Справка', words: { en: ['help', 'tutorial', 'how to play'], de: ['hilfe', 'anleitung'], fr: ['aide', 'tutoriel'], es: ['ayuda', 'tutorial'], it: ['aiuto', 'tutorial'], pt: ['ajuda', 'tutorial'], pl: ['pomoc', 'samouczek'], ru: ['справка', 'помощь', 'обучение'], uk: ['довідка', 'допомога', 'навчання'] } },
]

// Words that are in dialogs and prompts as well as in menus: they do not tell a menu by themselves
const WEAK = new Set(['yes', 'no', 'confirm', 'cancel', 'select', 'apply', 'items', 'journal', 'weapons', 'character', 'help'])

/** How many different words of a menu (not the weak ones) are among these concepts. */
export function menuWordCount(ids: Set<string> | string[]): number {
    const strong = new Set<string>()
    ids.forEach((id: string) => {
        if(!WEAK.has(id)){
            strong.add(id)
        }
    })
    return strong.size
}

// The word or phrase -> the id of the concept (per language)
const LOOKUP: Record<string, Map<string, string>> = {}
for(const concept of CONCEPTS){
    for(const [language, words] of Object.entries(concept.words)){
        if(LOOKUP[language] === undefined){
            LOOKUP[language] = new Map()
        }
        words.forEach(word => LOOKUP[language].set(word, concept.id))
    }
}

const NOT_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'gu')

/** The text in lower case, with only letters, digits and single spaces. */
function plain(text: string): string {
    return text.toLowerCase().replace(NOT_WORD, ' ').trim()
}

/**
 * The words of the interface in a text: the ids of the concepts whose word or phrase is the whole text, or a part of it
 * between other words ("OPEN INVENTORY", "Quit to menu").
 */
export function menuConcepts(text: string, language: string): string[] {
    const lookup = LOOKUP[language]
    if(lookup === undefined){
        return []
    }

    const clean = plain(text)
    if(clean === '' || clean.length > 60){
        return []
    }

    const found = new Set<string>()
    const whole = lookup.get(clean)
    if(whole !== undefined){
        found.add(whole)
    }

    // A phrase inside the text (the longest ones first, so "quit to menu" is not also "quit")
    const padded = ' ' + clean + ' '
    const phrases = Array.from(lookup.keys()).sort((a, b) => b.length - a.length)
    let rest = padded
    for(const phrase of phrases){
        const needle = ' ' + phrase + ' '
        if(rest.indexOf(needle) >= 0){
            found.add(lookup.get(phrase) as string)
            rest = rest.split(needle).join(' ')
        }
    }
    return Array.from(found)
}

/**
 * The translation of a label that is exactly a word of the interface (English into Ukrainian or Russian), or null when
 * the text is anything else. The case of the text does not matter ("PAUSED", "Paused").
 */
export function glossaryTranslation(text: string, source: string, target: string): string | null {
    if(source !== 'en' || (target !== 'uk' && target !== 'ru')){
        return null
    }

    const clean = plain(text)
    const id = LOOKUP.en?.get(clean)
    if(id === undefined){
        return null
    }

    const concept = CONCEPTS.find(item => item.id === id)
    const translated = concept === undefined ? undefined : concept[target]
    if(translated === undefined){
        return null
    }

    // "Paused" is the state, not the name of the menu: the same word is fine in a menu title
    return translated
}
