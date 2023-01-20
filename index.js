// https://www.mit.edu/~ecprice/wordlist.10000
// https://www-personal.umich.edu/~jlawler/wordlist
// https://www.ef.edu/english-resources/english-vocabulary/top-3000-words/
import fs from 'fs';
import inquirer from 'inquirer';
const MAX_WORD_LENGTH = 9;
const GAME_STRING_LENGTH = 19;

let adjList;
let finalWords = [];
let helper = [];

let words = fs.readFileSync('scrabble_dictionary_lowercase.txt', 'utf-8').split('\n');
let wordsMap = {};
words.map((word) => wordsMap[word] = true);

// 1. Get game string
inquirer.prompt([{
    type: 'input',
    name: 'gameString',
    message: 'Input the 19 letters of the grid from left to right, top to bottom:',
}]).then((answers) => {
    let inputStr = answers.gameString.replaceAll(' ', '');
    if (!inputStr || inputStr < GAME_STRING_LENGTH) throw Error;

    // 2. Run word search.
    let rows = createRowsFromInputStr(inputStr);
    adjList = createAdjList(rows);
    for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
            let startNode = rows[i][j];
            runBFSFrom(startNode, [JSON.stringify(startNode)], startNode.letter, startNode.letterValue);
        }
    }

    // 3. Print results.
    printFinalWords(finalWords);
    printAsGrid(rows);
}).catch(e => {
    console.log(e);
});

function printAsGrid(rows) {
    for (let i = 0; i < rows.length; i++) {
        if (i < 2) process.stdout.write(Array(2-i + 1).join(" ")); 
        if (i > 2) process.stdout.write(Array(Math.abs(i - 2 + 1)).join(" "));
        for (let item of rows[i]) process.stdout.write(item.letter.toUpperCase() + " ");
        process.stdout.write("\n");
    }
}

function createRowsFromInputStr(inputStr) {
    let rows = [];
    rows.push(inputStr.substring(0,3));
    rows.push(inputStr.substring(3,7));
    rows.push(inputStr.substring(7,12));
    rows.push(inputStr.substring(12,16));
    rows.push(inputStr.substring(16,19));
    for (let i = 0; i < rows.length; i++) {
        rows[i] = rows[i].split("");
    }
    for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
            const letter = rows[i][j];
            rows[i][j] = {
                letter: letter,
                row: i,
                col: j,
                letterValue: getLetterValue(letter)
            }
        }
    }
    return rows;
}

function printFinalWords(finalWords) {
    finalWords.sort((a,b) => a.start.row - b.start.row);
    finalWords = pruneDuplicates(finalWords);

    // Final words: sort by row, pretty print
    let finalRows = [];

    for (let word of finalWords) {
        let wordRow = word.start.row;
        if (!finalRows[wordRow]) finalRows[wordRow] = [];
        finalRows[wordRow].push(word);
    }

    let rowLengths = finalRows.map(row=>row.length);
    let maxRowLength = Math.max(...rowLengths);
    let seenCoordinates = {};
    for (let i = 0; i < maxRowLength; i++) {
        let lineToPrint = '';
        for (let row of finalRows) {
            if (row[i]) {
                let thisWord = row[i];
                let color = (thisWord.str.length > 4) ? '\x1b[36m %s\x1b[0m' : '';
                let numSpaces = MAX_WORD_LENGTH - thisWord.str.length + 2;
                let spaces = Array(numSpaces).join(" ");
                thisWord.str = thisWord.str.toUpperCase();
                process.stdout.write((color) ? colorize(thisWord.str) : thisWord.str );
                process.stdout.write(spaces);

                let wordInfo = `${thisWord.wordValue} pts `;
                let seenCoordinatesKey = `${thisWord.start.row},${thisWord.start.col}`;
                if (!seenCoordinates[seenCoordinatesKey]) {
                    wordInfo += `(${thisWord.start.row+1}, ${thisWord.start.col+1})`;
                    seenCoordinates[seenCoordinatesKey] = true;
                }
                process.stdout.write(wordInfo);
                process.stdout.write(Array(17 - wordInfo.length).join(" "));

            } else {
                // print empty string of correct length, hardcode for now
                process.stdout.write(Array(27).join(" "));
            }
        }
        process.stdout.write('\n');
    }

    console.log(finalWords.length)
}

// Colorize a string, green by default
function colorize(str) {
    return ['\x1b[92m\x1b[1m', str, '\x1b[22m\x1b[0m'].join('');
}

function getUserInput() {
    // TODO
}

// Create adjacency list/graph based on 2D array representing the letters in a particular game
function createAdjList(rows) {
    let adjList = {};
    // create all keys
    for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
            adjList[JSON.stringify(rows[i][j])] = [];
        }
    }  
    for (let i = 0; i < rows.length; i++) {
        // left to rights
        for (let j=0;j<rows[i].length-1;j++) {
            let key = JSON.stringify(rows[i][j]);
            adjList[key].push(rows[i][j+1]);
        }
        // right to lefts
        for (let j=rows[i].length - 1;j>0;j--) {
            let key = JSON.stringify(rows[i][j]);
            adjList[key].push(rows[i][j-1]);
        }
    }
    // top down from top to middle
    // store edge bidirectionally
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < rows[i].length; j++) {
            let key1 = JSON.stringify(rows[i][j]);
            let key2 = JSON.stringify(rows[i+1][j]);
            let key3 = JSON.stringify(rows[i+1][j+1]);
            adjList[key1].push(rows[i+1][j]);
            adjList[key1].push(rows[i+1][j+1]);
            adjList[key2].push(rows[i][j]);
            adjList[key3].push(rows[i][j]);
        }
    }
    // bottom up from bottom to middle
    // store edge bidirectionally
    for (let i = 4; i > 2; i--) {
        for (let j = 0; j < rows[i].length; j++) {
            let key1 = JSON.stringify(rows[i][j]);
            let key2 = JSON.stringify(rows[i-1][j]);
            let key3 = JSON.stringify(rows[i-1][j+1]);
            adjList[key1].push(rows[i-1][j]);
            adjList[key1].push(rows[i-1][j+1]);
            adjList[key2].push(rows[i][j]);
            adjList[key3].push(rows[i][j]);
        }
    }
    return adjList;
}

// Recursive breadth-first search implementation for finding words of length less than MAX_WORD_LENGTH from a start node
function runBFSFrom(startNode, visited, str, wordValue) {
    if (visited.length === MAX_WORD_LENGTH + 1) {
        return;
    }
    const isValidWord = wordsMap[str] && visited.length > 1 && hasVowels(str) && !helper.includes(str);
    if (isValidWord) {
        helper.push(str);
        finalWords.push({
            str: str,
            start: JSON.parse(visited[0]),
            wordValue: wordValue
        });
    }

    let neighbors = adjList[JSON.stringify(startNode)];
    for (let neighbor of neighbors) {
        let temp = [...visited]
        if (!visited.includes(JSON.stringify(neighbor))) {
            visited.push(JSON.stringify(neighbor));
            runBFSFrom(neighbor, visited, str + neighbor.letter, wordValue + neighbor.letterValue);
        }
        visited = [...temp]
    }
}

// Returns true if str contains any vowels.
function hasVowels(str) {
    let vowels = ['a','e','i','o','u'];
    for (let vowel of vowels) {
        if (str.indexOf(vowel) !== -1) {
            return true;
        }
    }
    return false;
}

// Gets point value for letter
function getLetterValue(letter) {
    const VALUES = {
        a: 1, e: 1, i: 1, o: 1, u: 1, l: 1, n: 1, s: 1, t: 1, r: 1,
        d: 2, g: 2,
        b: 3, c: 3, m: 3, p: 3,
        f: 4, h: 4, v: 4, w: 4, y: 4,
        k: 5,
        j: 8, x: 8,
        q: 10, z: 10
    };
    return VALUES[letter.toLowerCase()];
}

// Takes an array where entries are objects {str: String, start: { row: Num, col: Num}} and removes duplicate entries.
function pruneDuplicates(arr) {
    let wordMap = {};
    let newArr = [];
    for (let item of arr) {
        if (!wordMap[item.str]) {
            newArr.push(item);
            wordMap[item.str] = true;
        }
    }
    return newArr;
}
