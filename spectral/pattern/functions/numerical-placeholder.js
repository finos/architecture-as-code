
export default (input, _, context) => {
    if (input == -1) {
        return [{
            message: 'Value was equal to -1 - placeholder property detected',
            path: [...context.path]
        }]
    }
}