export default function Board() {
    const squares = Array.from({ length: 81 });

    return (
        <div className="board">
            {squares.map((_, index) => (
                <div className="square" key={index} />
            ))}
        </div>
    );
}